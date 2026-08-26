import { useId, useRef, useState } from "react";
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
      <ul className="divide-y border-y bg-white">
        {attachments.map((attachment) => (
          <li className="flex items-center justify-between gap-3 px-4 py-3" key={attachment.id}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                <bdi dir="auto">{attachment.fileName}</bdi>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
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
        <p className="mt-2 text-sm text-red-700" role="alert">
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
}: {
  onUpload: (file: File) => Promise<unknown>;
  isPending: boolean;
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

  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <label className="block text-sm font-medium" htmlFor={inputId}>
        {t("attachments.selectFile")}
      </label>
      <p className="mt-1 text-xs text-muted-foreground" id={helpId}>
        {t("attachments.acceptedTypes")} · {t("attachments.maxSize", { size: `${MAX_MIB} MiB` })}
      </p>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="mt-2 block w-full text-sm file:me-3 file:rounded-md file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm"
        accept={ACCEPTED_INPUT_ACCEPT}
        aria-describedby={helpId}
        disabled={isPending}
        onChange={(event) => pick(event.target.files?.[0])}
      />
      {file && (
        <p className="mt-2 text-sm">
          {t("attachments.selectedFile")}: <bdi dir="auto" className="font-medium">{file.name}</bdi>{" "}
          <span className="text-muted-foreground">({formatBytes(file.size)})</span>
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 text-sm text-green-700" role="status">
          {t("attachments.uploadSuccess")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="button-primary" disabled={!file || isPending} onClick={submit}>
          {isPending ? t("attachments.uploadPending") : failed ? t("attachments.retry") : t("attachments.upload")}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={isPending || (!file && !error && !success)}
          onClick={reset}
        >
          {t("attachments.cancel")}
        </button>
      </div>
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
      <h2 className="text-base font-semibold" id="attachments-heading">
        {t("attachments.title")}
      </h2>
      {canUpload && upload ? (
        <AttachmentUploadForm onUpload={(file) => upload.mutateAsync(file)} isPending={upload.isPending} />
      ) : disabledReason ? (
        <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">{disabledReason}</p>
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("common.loading")}
        </p>
      ) : isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {t("attachments.loadError")}{" "}
          <button type="button" className="button-secondary mt-2" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : attachments && attachments.length > 0 ? (
        <AttachmentRows attachments={attachments} scope={scope} locale={locale} />
      ) : (
        <p className="rounded-md border bg-white px-4 py-6 text-center text-sm text-muted-foreground">
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
          <li className="flex items-center justify-between gap-3 rounded-sm border bg-white px-2 py-1" key={attachment.id}>
            <span className="min-w-0 truncate text-xs font-medium">
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
        <p className="mt-1.5 text-xs text-red-700" role="alert">
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
