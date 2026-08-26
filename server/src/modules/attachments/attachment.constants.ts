// Shared constants for the secure attachments feature (feature/attachments).
// No Prisma schema change: the Attachment model is used as-is.

/** Maximum accepted upload size and maximum retrievable stored-object size. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4 MiB

/**
 * Server-validated MIME allowlist. The client-provided MIME type, multipart
 * filename, and file extension are never trusted; the stored `mimeType` is the
 * type detected from the file content.
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Upper bound on the preserved display filename. */
export const MAX_FILE_NAME_LENGTH = 200;

/** Safe fallback when the original filename is empty or entirely unsafe. */
export const FALLBACK_FILE_NAME = "file";

/** Multipart field name that carries the single uploaded file. */
export const UPLOAD_FIELD_NAME = "file";
