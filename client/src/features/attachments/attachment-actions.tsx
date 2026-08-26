import { useTranslation } from "react-i18next";
import { DownloadIcon, PreviewIcon, SpinnerIcon } from "./attachment-icons";

interface AttachmentRef {
  id: string;
  fileName: string;
  mimeType: string;
}

const ICON_BUTTON =
  "inline-flex size-10 items-center justify-center rounded-md border text-foreground transition-colors " +
  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Compact Preview + Download icon action group for one attachment. Icons are
 * decorative; the accessible name and tooltip come from localized strings.
 * Authorization stays on the backend — these controls only trigger the
 * authenticated download API.
 */
export function AttachmentActions({
  attachment,
  downloadPending,
  onDownload,
  onPreview,
}: {
  attachment: AttachmentRef;
  downloadPending: boolean;
  onDownload: (attachment: AttachmentRef) => void;
  onPreview: (trigger: HTMLButtonElement, attachment: AttachmentRef) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={t("attachments.previewAttachment")}
        title={t("attachments.previewAttachment")}
        onClick={(event) => onPreview(event.currentTarget, attachment)}
      >
        <PreviewIcon />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={t("attachments.downloadAttachment")}
        title={t("attachments.downloadAttachment")}
        disabled={downloadPending}
        onClick={() => onDownload(attachment)}
      >
        {downloadPending ? <SpinnerIcon /> : <DownloadIcon />}
      </button>
    </div>
  );
}
