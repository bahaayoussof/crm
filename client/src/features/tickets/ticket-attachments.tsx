import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AttachmentCompactGrid } from "@/features/attachments/attachment-ui";
import { TicketDetailSection } from "./ticket-detail-header";

type AttachmentItem = { id: string; fileName: string; mimeType: string; createdAt: string };

/** How many attachment cards the compact band shows before "View all". */
const DEFAULT_VISIBLE = 3;

/** Ticket-level attachments card, rendered under the conversation. One compact
 * horizontal row of cards on desktop (first {@link DEFAULT_VISIBLE}); the count
 * and a "View all" / "Show less" toggle live in the card header. Read-only —
 * upload happens in the composer footer. */
export function TicketAttachments({
  attachments,
  isLoading,
  isError,
  onRetry,
  locale,
  scope = "internal",
  className = "",
}: {
  attachments: AttachmentItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  locale: string;
  /** Which authenticated download/preview endpoint the rows use. */
  scope?: "internal" | "portal";
  className?: string;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasMore = attachments.length > DEFAULT_VISIBLE;
  const visible = showAll ? attachments : attachments.slice(0, DEFAULT_VISIBLE);

  return (
    <TicketDetailSection
      heading={t("attachments.title")}
      headingId="ticket-attachments-heading"
      headerSlot={
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">{attachments.length}</span>
          {hasMore && (
            <button
              type="button"
              className="rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? t("attachments.showLess") : t("attachments.viewAll")}
            </button>
          )}
        </div>
      }
      className={className}
      bodyClassName={showAll ? "lg:max-h-[20rem] lg:overflow-y-auto" : ""}
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
        <AttachmentCompactGrid attachments={visible} scope={scope} locale={locale} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("attachments.none")}</p>
      )}
    </TicketDetailSection>
  );
}
