import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { ticketReference } from "./ticket-format";
import type { TicketDetail } from "./ticket.types";

/** Compact ticket header: back link, id, subject, glanceable status/priority/channel, and Edit.
 * No card surface — a single bottom divider keeps it visually light. */
export function TicketDetailHeader({ record, canManage }: { record: TicketDetail; canManage: boolean }) {
  const { t } = useTranslation();
  return (
    <header className="border-b border-border pb-4">
      <Link
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        to="/tickets"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
        <span>{t("tickets.backToList")}</span>
      </Link>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
            {record.subject}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-xs font-medium text-primary" dir="ltr">
              {ticketReference(record.id)}
            </span>
            <TicketStatusBadge status={record.status} />
            <TicketPriorityText priority={record.priority} />
            <span className="text-xs text-muted-foreground">{t(`tickets.channel.${record.channel}`)}</span>
          </div>
        </div>
        {canManage && (
          <Link className="button-secondary shrink-0" to={`/tickets/${record.id}/edit`}>
            {t("common.edit")}
          </Link>
        )}
      </div>
    </header>
  );
}
