import {
  ACCEPTED_INPUT_ACCEPT,
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
} from "@/features/attachments/attachment.types";

export { ACCEPTED_INPUT_ACCEPT, ACCEPTED_MIME_TYPES, MAX_ATTACHMENT_BYTES };

export interface FileUploadValidationResult {
  file?: File;
  error?: string;
}

export interface FileUploadModalProps {
  /** Controls modal open/closed state. */
  open: boolean;
  /** Callback fired when modal should open or close. */
  onOpenChange: (open: boolean) => void;
  /** Async upload handler provided by parent feature. */
  onUpload: (file: File) => Promise<unknown> | void;
  /** Indicates an ongoing upload mutation. */
  isUploading?: boolean;
  /** Accepted MIME types (defaults to project standard 5 types). */
  acceptedTypes?: readonly string[];
  /** Accepted input accept attribute string. */
  accept?: string;
  /** Maximum file size in bytes (defaults to 4 MiB). */
  maxSizeBytes?: number;
  /** Custom modal title (defaults to localized "Upload file"). */
  title?: string;
  /** Custom trigger/return focus ref for accessibility. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}
