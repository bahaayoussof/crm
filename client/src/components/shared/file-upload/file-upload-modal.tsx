import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAttachmentError } from "@/features/attachments/attachment-error";
import { FileDropzone } from "./file-dropzone";
import { SelectedFileRow } from "./selected-file-row";
import {
  ACCEPTED_INPUT_ACCEPT,
  ACCEPTED_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  type FileUploadModalProps,
} from "./file-upload.types";
import { validateUploadFile } from "./file-upload.utils";

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function FileUploadModal({
  open,
  onOpenChange,
  onUpload,
  isUploading = false,
  acceptedTypes = ACCEPTED_MIME_TYPES,
  accept = ACCEPTED_INPUT_ACCEPT,
  maxSizeBytes = MAX_ATTACHMENT_BYTES,
  title,
  returnFocusRef,
}: FileUploadModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [internalPending, setInternalPending] = useState(false);

  const uploading = isUploading || internalPending;

  const resetLocalState = () => {
    setSelectedFile(null);
    setValidationError(null);
    setApiError(null);
    setInternalPending(false);
  };

  const handleClose = () => {
    if (uploading) return;
    resetLocalState();
    onOpenChange(false);
  };

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      dialogRef.current?.focus();
      return;
    }
    resetLocalState();
    if (!hasOpenedRef.current) return;
    const target = returnFocusRef?.current;
    if (target && document.body.contains(target)) {
      target.focus();
    }
  }, [open, returnFocusRef]);

  const handleFileSelect = (file: File) => {
    setValidationError(null);
    setApiError(null);
    const result = validateUploadFile(file, t, maxSizeBytes, acceptedTypes);
    if (result.error || !result.file) {
      setSelectedFile(null);
      setValidationError(result.error ?? t("attachments.errors.UNSUPPORTED_FILE_TYPE"));
      return;
    }
    setSelectedFile(result.file);
  };

  const handleRemoveFile = () => {
    if (uploading) return;
    setSelectedFile(null);
    setValidationError(null);
    setApiError(null);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || uploading) return;
    setValidationError(null);
    setApiError(null);
    setInternalPending(true);

    try {
      await onUpload(selectedFile);
      resetLocalState();
      onOpenChange(false);
    } catch (err) {
      setInternalPending(false);
      setApiError(getAttachmentError(err, "attachments.uploadFailure", t));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      handleClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = focusables(dialogRef.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const maxMib = Math.round(maxSizeBytes / (1024 * 1024));
  const activeError = validationError || apiError;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
        onMouseDown={handleClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative z-10 my-auto flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {title ?? t("attachments.selectFile", "Upload file")}
          </h2>
          <button
            type="button"
            disabled={uploading}
            onClick={handleClose}
            aria-label={t("attachments.closePreview", "Close")}
            title={t("attachments.closePreview", "Close")}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex flex-col gap-4 p-6">
          {/* Dropzone */}
          <FileDropzone
            onFileSelect={handleFileSelect}
            accept={accept}
            disabled={uploading}
          />

          {/* Helper / constraints banner */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500/90" strokeWidth={2} aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate">
              {t("attachments.acceptedTypes")}
              <span className="mx-1.5" aria-hidden="true">•</span>
              {t("attachments.maxSize", { size: `${maxMib} MiB` })}
            </p>
          </div>

          {/* Validation or API Error Alert */}
          {activeError && (
            <div
              role="alert"
              className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-xs font-medium text-danger"
            >
              {activeError}
            </div>
          )}

          {/* Selected File State */}
          {selectedFile && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("attachments.selectedFile", "Selected file")}
              </p>
              <SelectedFileRow
                file={selectedFile}
                onRemove={handleRemoveFile}
                disabled={uploading}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex items-center justify-end gap-3 border-t border-border/80 bg-surface/40 px-6 py-4">
          <button
            type="button"
            disabled={uploading}
            onClick={handleClose}
            className="button-secondary sm:w-auto"
          >
            {t("attachments.cancel", "Cancel")}
          </button>
          <button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleUploadSubmit}
            className="button-primary inline-flex items-center gap-2 sm:w-auto"
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                <span>{t("attachments.uploadPending", "Uploading…")}</span>
              </>
            ) : (
              <>
                <Upload className="size-4" strokeWidth={2} aria-hidden="true" />
                <span>{t("attachments.uploadShort", "Upload")}</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
