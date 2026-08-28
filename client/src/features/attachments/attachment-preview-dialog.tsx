import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CloseIcon, DownloadIcon, SpinnerIcon } from "./attachment-icons";
import type { PreviewState } from "./attachment-preview";

interface DownloadController {
  download: (attachment: { id: string; fileName: string }) => void;
  pendingId: string | null;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

/**
 * Accessible modal preview for a single authorized attachment. Renders an image,
 * the browser's built-in PDF viewer, or escaped plain text from a temporary
 * in-memory object URL. Escape and the close button dismiss it; loading failure
 * never dismisses it. Download stays available inside the dialog.
 */
export function AttachmentPreviewDialog({
  state,
  onClose,
  onRetry,
  download,
}: {
  state: PreviewState;
  onClose: () => void;
  onRetry: () => void;
  download: DownloadController;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.open) dialogRef.current?.focus();
  }, [state.open]);

  if (!state.open || !state.target) return null;
  const { target } = state;
  const downloading = download.pendingId === target.id;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-lg outline-none"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold">
            <span className="text-muted-foreground">{t("attachments.previewTitle")}: </span>
            <bdi dir="auto">{target.fileName}</bdi>
          </h2>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md border text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
            aria-label={t("attachments.downloadAttachment")}
            title={t("attachments.downloadAttachment")}
            disabled={downloading}
            onClick={() => download.download(target)}
          >
            {downloading ? <SpinnerIcon /> : <DownloadIcon />}
          </button>
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md border text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t("attachments.closePreview")}
            title={t("attachments.closePreview")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-40 flex-1 overflow-auto bg-surface-subtle p-4">
          {state.status === "loading" && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <SpinnerIcon />
              {t("attachments.previewLoading")}
            </p>
          )}

          {state.status === "error" && (
            <div className="py-8 text-center">
              <p className="text-sm text-danger" role="alert">
                {state.error ?? t("attachments.previewFailed")}
              </p>
              <button type="button" className="button-secondary mt-3" onClick={onRetry}>
                {t("attachments.retryPreview")}
              </button>
            </div>
          )}

          {state.status === "ready" && state.kind === "image" && state.objectUrl && (
            <img
              src={state.objectUrl}
              alt={target.fileName}
              className="mx-auto max-h-[70vh] max-w-full object-contain"
            />
          )}

          {state.status === "ready" && state.kind === "pdf" && state.objectUrl && (
            <div>
              <iframe title={target.fileName} src={state.objectUrl} className="h-[70vh] w-full rounded-sm border border-border bg-surface" />
              <p className="mt-2 text-xs text-muted-foreground">{t("attachments.pdfPreviewUnavailable")}</p>
            </div>
          )}

          {state.status === "ready" && state.kind === "text" && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-sm border border-border bg-surface p-3 text-xs leading-5">
              {state.text}
            </pre>
          )}

          {state.status === "ready" && state.kind === "unsupported" && (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">{t("attachments.previewUnavailable")}</p>
              <button
                type="button"
                className="button-secondary mt-3"
                disabled={downloading}
                onClick={() => download.download(target)}
              >
                {downloading ? t("attachments.downloadPending") : t("attachments.download")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
