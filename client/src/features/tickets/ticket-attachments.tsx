import { useTranslation } from "react-i18next";
import { AttachmentRows } from "@/features/attachments/attachment-ui";
import { TicketDetailSection } from "./ticket-detail-header";

type AttachmentItem = { id: string; fileName: string; mimeType: string; createdAt: string };

/** Ticket-level attachments list, rendered below the composer in the conversation column
 * where it has room to breathe. Upload happens in the attach-file band above the composer —
 * this section is read-only (list + preview/download via `AttachmentRows`). */
export function TicketAttachments({
  attachments,
  isLoading,
  isError,
  onRetry,
  locale,
  className = "",
}: {
  attachments: AttachmentItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  locale: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <TicketDetailSection
      heading={t("attachments.title")}
      headingId="ticket-attachments-heading"
      headerSlot={<span className="shrink-0 text-xs font-medium text-muted-foreground">{attachments.length}</span>}
      className={className}
      bodyClassName="lg:max-h-[20rem] lg:overflow-y-auto"
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("common.loading")}
        </p>
      ) : isError ? (
        <div
          className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground"
          role="alert"
        >
          {t("attachments.loadError")}{" "}
          <button type="button" className="button-secondary mt-2" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : attachments.length > 0 ? (
        <AttachmentRows attachments={attachments} scope="internal" locale={locale} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("attachments.none")}</p>
      )}
    </TicketDetailSection>
  );
}
