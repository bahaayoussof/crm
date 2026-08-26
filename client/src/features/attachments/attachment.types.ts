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
