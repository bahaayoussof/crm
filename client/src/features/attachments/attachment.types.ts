/** Internal attachment metadata projection (never includes storageKey / provider data). */
export interface InternalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  ticketId: string | null;
  messageId: string | null;
  customerId: string | null;
}

/** Portal attachment metadata projection — messageId only, for conversation grouping. */
export interface PortalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  messageId: string | null;
}

export interface AttachmentListResponse<T> {
  data: T[];
}

/** Accepted upload types and the size limit, shared with the UI copy. */
export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"] as const;
export const ACCEPTED_INPUT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.txt,image/jpeg,image/png,image/webp,application/pdf,text/plain";
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/**
 * Client-side pre-validation for a picked attachment — the same rules the upload
 * form applies. Returns the file when acceptable, or a localized error string.
 * Used by the composer "Attach file" controls so the native OS picker can
 * validate before the upload workspace mounts.
 */
export function validateAttachmentFile(
  file: File,
  t: (key: string) => string,
): { file?: File; error?: string } {
  if (file.size === 0) return { error: t("attachments.errors.EMPTY_FILE") };
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: t("attachments.errors.FILE_TOO_LARGE") };
  if (file.type && !ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number]))
    return { error: t("attachments.errors.UNSUPPORTED_FILE_TYPE") };
  return { file };
}
