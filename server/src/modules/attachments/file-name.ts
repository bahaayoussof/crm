// Filename sanitization and RFC 6266 / RFC 5987 Content-Disposition formatting.
// The stored `fileName` is display/download metadata only and is never used to
// build a storage key.

import { FALLBACK_FILE_NAME, MAX_FILE_NAME_LENGTH } from "./attachment.constants.js";

// C0 (0x00-0x1F), DEL (0x7F), and C1 (0x80-0x9F) control characters.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

/**
 * Produce a safe display filename:
 *  - strips Unix (`/`) and Windows (`\`) path segments, keeping the last segment
 *  - removes CR, LF, NUL and every other control character
 *  - collapses internal whitespace runs to a single space and trims
 *  - bounds length to MAX_FILE_NAME_LENGTH, preserving a short extension
 *  - falls back to FALLBACK_FILE_NAME when the result is empty
 * Safe Unicode (including Arabic) display names are preserved.
 */
export function sanitizeFileName(raw: unknown): string {
  if (typeof raw !== "string") return FALLBACK_FILE_NAME;

  // Last path segment across both separators.
  const segments = raw.split(/[/\\]/);
  let name = segments[segments.length - 1] ?? "";

  name = name.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  // Drop leading dots so "..", "." or "...pdf" cannot act as traversal or hidden files.
  name = name.replace(/^\.+/, "").trim();

  if (!name) return FALLBACK_FILE_NAME;

  if (name.length > MAX_FILE_NAME_LENGTH) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 && name.length - dot <= 12 ? name.slice(dot) : "";
    name = name.slice(0, MAX_FILE_NAME_LENGTH - ext.length).trim() + ext;
  }

  return name || FALLBACK_FILE_NAME;
}

/**
 * Build a `Content-Disposition: attachment` header value that is safe against
 * header injection. Emits an ASCII-only `filename="..."` fallback plus an
 * RFC 5987 `filename*=UTF-8''...` parameter for non-ASCII names.
 */
export function contentDispositionAttachment(fileName: string): string {
  const safe = sanitizeFileName(fileName);

  // ASCII fallback: printable ASCII only, quotes/backslashes stripped.
  const asciiFallback =
    safe
      .replace(CONTROL_CHARS, "")
      .replace(/[^\u0020-\u007E]/g, "_")
      .replace(/["\\]/g, "_")
      .replace(/[;,]/g, "_")
      .trim() || FALLBACK_FILE_NAME;

  const encoded = encodeRfc5987(safe);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value)
    // encodeURIComponent leaves these; RFC 5987 attr-char disallows some, so percent-encode them.
    .replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%(7C|60|5E)/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}
