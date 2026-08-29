import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { WatchToggle } from "@/features/collaboration/watch-toggle";
import { TicketPriorityText } from "./ticket-badges";
import type { TicketDetail } from "./ticket.types";

/** First letters of the first two words — a lightweight avatar stand-in. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function Cell({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

/**
 * Horizontal context strip under the ticket header: Customer | Priority |
 * Category | Channel | Followers, split by subtle separators. Status lives in the
 * header + rail, SLA in the rail — neither is repeated here.
 */
export function TicketContextSummary({ record }: { record: TicketDetail }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground shadow-subtle sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
      <Cell label={t("tickets.customer")} className="sm:flex-[1.6]">
        <div className="flex items-start gap-2.5">
          <span
            className="inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {initialsOf(record.customer.name)}
          </span>
          <div className="min-w-0">
            <Link
              className="block break-words font-semibold text-primary hover:underline [overflow-wrap:anywhere]"
              to={`/customers/${record.customer.id}`}
            >
              {record.customer.name}
            </Link>
            <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
              <bdi dir="ltr">{record.customer.email}</bdi>
            </p>
            <Link
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              to={`/customers/${record.customer.id}`}
            >
              {t("tickets.viewCustomer")}
              <span aria-hidden="true" className="rtl:rotate-180">
                →
              </span>
            </Link>
          </div>
        </div>
      </Cell>

      <Cell label={t("tickets.priorityLabel")} className="sm:flex-1">
        <TicketPriorityText priority={record.priority} />
      </Cell>

      <Cell label={t("tickets.category")} className="sm:flex-1">
        {record.category?.name ?? t("common.notProvided")}
      </Cell>

      <Cell label={t("tickets.channelLabel")} className="sm:flex-1">
        {t(`tickets.channel.${record.channel}`)}
      </Cell>

      <Cell label={t("collaboration.followers")} className="sm:flex-1">
        <WatchToggle
          ticketId={record.id}
          watching={record.viewerIsWatching ?? false}
          watcherCount={record.watcherCount ?? 0}
        />
      </Cell>
    </div>
  );
}
