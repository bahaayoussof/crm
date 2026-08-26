// Bounded, single-file multipart parser built on Busboy.
// The upload contract accepts exactly one part: a file named "file". No textual
// multipart fields are accepted — every `field` event causes a deterministic
// rejection (reserved names -> INVALID_ATTACHMENT_CONTEXT, any other text field
// -> INVALID_UPLOAD). Every rejection drains the request and settles the promise
// exactly once; no provider or database work is performed on a rejected request.

import type { Request } from "express";
import busboy from "busboy";
import { AppError } from "../../shared/errors/app-error.js";
import { FALLBACK_FILE_NAME, MAX_ATTACHMENT_BYTES, UPLOAD_FIELD_NAME } from "./attachment.constants.js";

export interface ParsedUpload {
  /** Raw multipart filename (unsanitized). Callers must sanitize before storing. */
  fileName: string;
  size: number;
  buffer: Buffer;
}

// Client-derivable metadata / context that must never come from the request body.
const RESERVED_FIELDS = new Set(["storageKey", "ticketId", "messageId", "customerId", "mimeType", "fileName", "createdAt"]);

// One documented code per failure condition (see docs/05-api-contract.md):
//   NO_FILE 422                 — no file part, or a file under the wrong field name
//   MULTIPLE_FILES 422          — more than one file part
//   EMPTY_FILE 422              — the file part has zero bytes
//   FILE_TOO_LARGE 413          — the file part exceeds MAX_ATTACHMENT_BYTES
//   INVALID_ATTACHMENT_CONTEXT 422 — a reserved textual field was submitted
//   INVALID_UPLOAD 422          — any other unexpected textual field, malformed
//                                multipart, a stream error, or an aborted request
export function parseSingleUpload(request: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = String(request.headers["content-type"] ?? "").toLowerCase();
    if (!contentType.startsWith("multipart/form-data")) {
      reject(new AppError(422, "INVALID_UPLOAD", "Expected a multipart/form-data upload with a single file part"));
      return;
    }

    let bb: busboy.Busboy;
    try {
      bb = busboy({
        headers: request.headers,
        limits: { files: 1, fileSize: MAX_ATTACHMENT_BYTES + 1, fields: 20, parts: 30, fieldSize: 8 * 1024 },
      });
    } catch {
      reject(new AppError(422, "INVALID_UPLOAD", "The multipart request could not be parsed"));
      return;
    }

    let settled = false;
    let fileSeen = false;
    let stop = false;
    let fileName = "";
    let size = 0;
    const chunks: Buffer[] = [];

    const cleanup = () => {
      try {
        request.unpipe(bb);
      } catch {
        /* ignore */
      }
      bb.removeAllListeners();
    };
    const fail = (error: AppError) => {
      if (settled) return;
      settled = true;
      stop = true;
      cleanup();
      request.resume(); // drain remaining bytes so the socket does not hang
      reject(error);
    };
    const succeed = (value: ParsedUpload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    bb.on("file", (name, stream, info) => {
      if (name !== UPLOAD_FIELD_NAME) {
        stream.resume();
        fail(new AppError(422, "NO_FILE", `Expected a single file part named "${UPLOAD_FIELD_NAME}"`));
        return;
      }
      if (fileSeen) {
        stream.resume();
        fail(new AppError(422, "MULTIPLE_FILES", "Only one file per request is allowed"));
        return;
      }
      fileSeen = true;
      fileName = typeof info.filename === "string" ? info.filename : "";
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_ATTACHMENT_BYTES) chunks.push(chunk);
      });
      stream.on("limit", () => {
        stream.resume();
        fail(new AppError(413, "FILE_TOO_LARGE", "The file exceeds the maximum allowed size"));
      });
      stream.on("error", () => fail(new AppError(422, "INVALID_UPLOAD", "The upload stream failed")));
    });

    bb.on("filesLimit", () => fail(new AppError(422, "MULTIPLE_FILES", "Only one file per request is allowed")));

    // No textual multipart fields are accepted. The field value is never read,
    // logged, or echoed back.
    bb.on("field", (name: string) => {
      if (RESERVED_FIELDS.has(name)) {
        fail(new AppError(422, "INVALID_ATTACHMENT_CONTEXT", `The "${name}" field is not accepted; attachment context is derived from the route`));
      } else {
        fail(new AppError(422, "INVALID_UPLOAD", `Unexpected multipart field; the upload must contain only a single file part named "${UPLOAD_FIELD_NAME}"`));
      }
    });

    bb.on("error", () => fail(new AppError(422, "INVALID_UPLOAD", "The multipart request could not be parsed")));
    bb.on("close", () => {
      if (settled || stop) return;
      if (!fileSeen) {
        fail(new AppError(422, "NO_FILE", "A file part named \"file\" is required"));
        return;
      }
      if (size > MAX_ATTACHMENT_BYTES) {
        fail(new AppError(413, "FILE_TOO_LARGE", "The file exceeds the maximum allowed size"));
        return;
      }
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) {
        fail(new AppError(422, "EMPTY_FILE", "The file is empty"));
        return;
      }
      succeed({ fileName: fileName || FALLBACK_FILE_NAME, size: buffer.length, buffer });
    });

    request.on("aborted", () => fail(new AppError(422, "INVALID_UPLOAD", "The upload request was aborted")));
    request.on("error", () => fail(new AppError(422, "INVALID_UPLOAD", "The upload request failed")));
    request.pipe(bb);
  });
}
