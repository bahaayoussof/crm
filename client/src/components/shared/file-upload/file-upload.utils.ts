import {
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  type FileUploadValidationResult,
} from "./file-upload.types";

/**
 * Format bytes into human-readable size string (e.g. "40 KB", "1.5 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) return "0 B";
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Map MIME type or filename extension to a concise display label (e.g. "PDF", "PNG", "JPEG", "WebP", "TXT").
 */
export function getFileTypeLabel(file: { name?: string; type?: string }): string {
  const mime = file.type?.toLowerCase() || "";
  const name = file.name?.toLowerCase() || "";

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "PDF";
  if (mime === "image/png" || name.endsWith(".png")) return "PNG";
  if (mime === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPEG";
  if (mime === "image/webp" || name.endsWith(".webp")) return "WebP";
  if (mime === "text/plain" || name.endsWith(".txt")) return "TXT";

  if (mime.startsWith("image/")) return "IMG";
  if (mime) {
    const sub = mime.split("/")[1]?.toUpperCase();
    if (sub && sub.length <= 4) return sub;
  }
  const ext = name.split(".").pop()?.toUpperCase();
  if (ext && ext.length <= 4) return ext;

  return "FILE";
}

/**
 * Validate selected/dropped file before upload.
 */
export function validateUploadFile(
  file: File,
  t: (key: string, options?: Record<string, unknown>) => string,
  maxSizeBytes: number = MAX_ATTACHMENT_BYTES,
  acceptedTypes: readonly string[] = ACCEPTED_MIME_TYPES,
): FileUploadValidationResult {
  if (!file) {
    return { error: t("attachments.errors.NO_FILE") };
  }
  if (file.size === 0) {
    return { error: t("attachments.errors.EMPTY_FILE") };
  }
  if (file.size > maxSizeBytes) {
    return { error: t("attachments.errors.FILE_TOO_LARGE") };
  }
  if (
    file.type &&
    acceptedTypes.length > 0 &&
    !acceptedTypes.includes(file.type)
  ) {
    return { error: t("attachments.errors.UNSUPPORTED_FILE_TYPE") };
  }
  return { file };
}
