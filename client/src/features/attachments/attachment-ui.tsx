import { useId, useRef, useState } from "react";
import { FileText, Image as ImageIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { AttachmentActions } from "./attachment-actions";
import { useAttachmentDownload } from "./attachment-download";
import { getAttachmentError } from "./attachment-error";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";
import { useAttachmentPreview } from "./attachment-preview";
import { ACCEPTED_INPUT_ACCEPT, ACCEPTED_MIME_TYPES, MAX_ATTACHMENT_BYTES } from "./attachment.types";

interface AttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
}

const MAX_MIB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Human-friendly short type label for the selected-file preview (falls back to the raw MIME type). */
function shortType(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/webp": "WebP",
    "text/plain": "TXT",
  };
  return map[mimeType] ?? mimeType;
}

/** Read-only list of attachments with compact Preview + Download icon actions per row. */
export function AttachmentRows({
  attachments,
  scope,
  locale,
}: {
  attachments: AttachmentItem[];
  scope: "internal" | "portal";
  locale: string;
}) {
  const downloadCtl = useAttachmentDownload(scope);
  const previewCtl = useAttachmentPreview(scope);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openPreview = (trigger: HTMLButtonElement, attachment: { id: string; fileName: string; mimeType: string }) => {
    triggerRef.current = trigger;
    void previewCtl.openPreview(attachment);
  };
  const closePreview = () => {
    previewCtl.close();
    triggerRef.current?.focus();
  };
  return (
    <div>
      <ul className="divide-y divide-border-subtle border-y border-border bg-surface">
        {attachments.map((attachment) => (
          <li className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover transition-colors" key={attachment.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground" title={attachment.fileName}>
                <bdi dir="auto">{attachment.fileName}</bdi>
              </p>
              <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                <bdi dir="ltr">{attachment.mimeType}</bdi>
                <span aria-hidden="true"> · </span>
                <bdi dir="ltr">{formatTicketDate(attachment.createdAt, locale)}</bdi>
              </p>
            </div>
            <AttachmentActions
              attachment={attachment}
              downloadPending={downloadCtl.pendingId === attachment.id}
              onDownload={downloadCtl.download}
              onPreview={openPreview}
            />
          </li>
        ))}
      </ul>
      {downloadCtl.error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {downloadCtl.error}
        </p>
      )}
      <AttachmentPreviewDialog
        state={previewCtl.state}
        onClose={closePreview}
        onRetry={previewCtl.retry}
        download={{ download: downloadCtl.download, pendingId: downloadCtl.pendingId }}
      />
    </div>
  );
}

/** Keyboard-accessible single-file upload control with client-side pre-validation. */
export function AttachmentUploadForm({
  onUpload,
  isPending,
  onClose,
  uploadLabel,
}: {
  onUpload: (file: File) => Promise<unknown>;
  isPending: boolean;
  /** When provided, the Cancel button also collapses the form (and is never disabled while idle). */
  onClose?: () => void;
  /** Overrides the submit button label (default: `attachments.upload`). */
  uploadLabel?: string;
}) {
  const { t } = useTranslation();
  const inputId = useId();
  const helpId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setFailed(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pick = (picked: File | undefined) => {
    setError(null);
    setSuccess(false);
    setFailed(false);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size === 0) {
      setFile(null);
      setError(t("attachments.errors.EMPTY_FILE"));
      return;
    }
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setFile(null);
      setError(t("attachments.errors.FILE_TOO_LARGE"));
      return;
    }
    if (picked.type && !ACCEPTED_MIME_TYPES.includes(picked.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      setFile(null);
      setError(t("attachments.errors.UNSUPPORTED_FILE_TYPE"));
      return;
    }
    setFile(picked);
  };

  const submit = async () => {
    if (!file || isPending) return;
    setError(null);
    setFailed(false);
    try {
      await onUpload(file);
      setSuccess(true);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setFailed(true);
      setError(getAttachmentError(caught, "attachments.uploadFailure", t));
    }
  };

  const FileIcon = file?.type.startsWith("image/") ? ImageIcon : FileText;
  return (
    <div className="rounded-xl border border-border bg-surface-subtle/50 p-4">
      <p className="text-sm font-medium text-foreground">{t("attachments.selectFile")}</p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground" id={helpId}>
        <p className="break-words">{t("attachments.acceptedTypes")}</p>
        <p className="break-words">{t("attachments.maxSize", { size: `${MAX_MIB} MiB` })}</p>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="peer sr-only"
        accept={ACCEPTED_INPUT_ACCEPT}
        aria-label={t("attachments.selectFile")}
        aria-describedby={helpId}
        disabled={isPending}
        onChange={(event) => pick(event.target.files?.[0])}
      />
      <label
        htmlFor={inputId}
        className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-55"
      >
        <FileText className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {t("attachments.chooseFile")}
      </label>
      {file && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-border bg-surface p-3">
          <FileIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground" title={file.name}>
              <bdi dir="auto">{file.name}</bdi>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <bdi dir="ltr">
                {shortType(file.type)} · {formatBytes(file.size)}
              </bdi>
            </p>
          </div>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
            aria-label={t("attachments.removeFile")}
            title={t("attachments.removeFile")}
            disabled={isPending}
            onClick={reset}
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 text-sm text-success" role="status">
          {t("attachments.uploadSuccess")}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="button-secondary sm:w-auto"
          disabled={isPending || (!onClose && !file && !error && !success)}
          onClick={() => {
            reset();
            onClose?.();
          }}
        >
          {t("attachments.cancel")}
        </button>
        <button type="button" className="button-primary sm:w-auto" disabled={!file || isPending} onClick={submit}>
          {isPending
            ? t("attachments.uploadPending")
            : failed
              ? t("attachments.retry")
              : (uploadLabel ?? t("attachments.upload"))}
        </button>
      </div>
    </div>
  );
}

/**
 * The "Attach file" band that sits between the scrollable conversation and the
 * reply composer. Presentation only — the caller supplies the upload behaviour
 * (`upload`) and, when uploading is not available, the reason to show in its
 * place (`disabledReason`). Used by both the internal Ticket Details view and the
 * Customer Portal ticket view so the attachment input has one placement + look.
 */
export function ConversationAttachmentBand({
  canUpload,
  upload,
  disabledReason,
  uploadLabel,
}: {
  canUpload: boolean;
  upload?: { mutateAsync: (file: File) => Promise<unknown>; isPending: boolean };
  /** Shown in place of the trigger when `canUpload` is false (default: assignment hint). */
  disabledReason?: string;
  /** Overrides the submit button label inside the revealed form (default: `attachments.uploadShort`). */
  uploadLabel?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3 sm:p-4">
      {!canUpload || !upload ? (
        <p className="text-xs text-muted-foreground">{disabledReason ?? t("attachments.uploadRequiresAssignment")}</p>
      ) : open ? (
        <AttachmentUploadForm
          onUpload={(file) => upload.mutateAsync(file)}
          isPending={upload.isPending}
          onClose={() => setOpen(false)}
          uploadLabel={uploadLabel ?? t("attachments.uploadShort")}
        />
      ) : (
        <button type="button" className="button-secondary sm:w-auto" onClick={() => setOpen(true)}>
          {t("attachments.attachFile")}
        </button>
      )}
    </div>
  );
}

/** Full attachments panel: heading, optional upload control or disabled reason, then the list. */
export function AttachmentPanel({
  attachments,
  isLoading,
  isError,
  onRetry,
  scope,
  locale,
  canUpload,
  upload,
  disabledReason,
  emptyText,
}: {
  attachments: AttachmentItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  scope: "internal" | "portal";
  locale: string;
  canUpload: boolean;
  upload?: { mutateAsync: (file: File) => Promise<unknown>; isPending: boolean };
  disabledReason?: string;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="attachments-heading" className="space-y-3">
      <h2 className="text-base font-semibold text-foreground" id="attachments-heading">
        {t("attachments.title")}
      </h2>
      {canUpload && upload ? (
        <AttachmentUploadForm onUpload={(file) => upload.mutateAsync(file)} isPending={upload.isPending} />
      ) : disabledReason ? (
        <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">{disabledReason}</p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("common.loading")}
        </p>
      ) : isError ? (
        <div className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">
          {t("attachments.loadError")}{" "}
          <button type="button" className="button-secondary mt-2" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : attachments && attachments.length > 0 ? (
        <AttachmentRows attachments={attachments} scope={scope} locale={locale} />
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyText ?? t("attachments.none")}
        </p>
      )}
    </section>
  );
}

/** Compact attachment list shown beneath a public conversation message, with the
 * same Preview + Download icon actions as the main list. */
export function MessageAttachmentList({
  attachments,
  scope,
}: {
  attachments: AttachmentItem[];
  scope: "internal" | "portal";
}) {
  const { t } = useTranslation();
  const downloadCtl = useAttachmentDownload(scope);
  const previewCtl = useAttachmentPreview(scope);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const openPreview = (trigger: HTMLButtonElement, attachment: { id: string; fileName: string; mimeType: string }) => {
    triggerRef.current = trigger;
    void previewCtl.openPreview(attachment);
  };
  const closePreview = () => {
    previewCtl.close();
    triggerRef.current?.focus();
  };
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2">
      <ul className="flex flex-col gap-1.5" aria-label={t("attachments.title")}>
        {attachments.map((attachment) => (
          <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-2xs" key={attachment.id}>
            <span className="min-w-0 truncate text-xs font-medium text-foreground" title={attachment.fileName}>
              <span aria-hidden="true">📎 </span>
              <bdi dir="auto">{attachment.fileName}</bdi>
            </span>
            <AttachmentActions
              attachment={attachment}
              downloadPending={downloadCtl.pendingId === attachment.id}
              onDownload={downloadCtl.download}
              onPreview={openPreview}
            />
          </li>
        ))}
      </ul>
      {downloadCtl.error && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {downloadCtl.error}
        </p>
      )}
      <AttachmentPreviewDialog
        state={previewCtl.state}
        onClose={closePreview}
        onRetry={previewCtl.retry}
        download={{ download: downloadCtl.download, pendingId: downloadCtl.pendingId }}
      />
    </div>
  );
}
