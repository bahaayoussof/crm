import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { WatchToggle } from "@/features/collaboration/watch-toggle";
import type { TicketDetail, TicketPriority } from "./ticket.types";

/** First letters of the first two words — a lightweight avatar stand-in. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const priorityDotClass: Record<TicketPriority, string> = {
  LOW: "bg-emerald-500 dark:bg-emerald-400",
  MEDIUM: "bg-muted-foreground",
  HIGH: "bg-warning",
  URGENT: "bg-danger",
};

/**
 * Simplified, lightweight context bar under the ticket header:
 * Customer | Priority | Category | Channel | Followers
 *
 * Responsive layout:
 * - Desktop (lg+): 1 row with weighted columns (1.6fr / 0.75fr / 1fr / 0.9fr / 0.65fr)
 * - Tablet (sm to lg): Customer on top row, 4 metadata columns on second row
 * - Mobile (<sm): Customer on top row, 2x2 metadata grid below
 */
export function TicketContextSummary({ record }: { record: TicketDetail }) {
  const { t } = useTranslation();
  const categoryName = record.category?.name ?? t("common.notProvided");
  const channelName = t(`tickets.channel.${record.channel}`);

  return (
    <div className="mt-3.5 grid grid-cols-2 rounded-lg border border-border bg-card text-start text-card-foreground sm:grid-cols-4 lg:grid-cols-[1.6fr_0.75fr_1fr_0.9fr_0.65fr]">
      {/* 1. Customer segment */}
      <div className="col-span-2 flex min-w-0 items-center gap-2.5 border-b border-border p-3 sm:col-span-4 sm:px-4 sm:py-2.5 lg:col-span-1 lg:border-b-0">
        <span
          className="inline-flex size-7.5 shrink-0 select-none items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted-foreground"
          aria-hidden="true"
        >
          {initialsOf(record.customer.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/customers/${record.customer.id}`}
            className="block break-words text-sm font-semibold text-foreground hover:underline line-clamp-2 [overflow-wrap:anywhere]"
            title={record.customer.name}
          >
            {record.customer.name}
          </Link>
        </div>
      </div>

      {/* 2. Priority segment */}
      <div className="col-span-1 flex min-w-0 flex-col justify-center p-3 sm:border-t-0 sm:px-4 sm:py-2.5 lg:border-s lg:border-border">
        <p className="text-xs font-medium text-muted-foreground">{t("tickets.priorityLabel")}</p>
        <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
          <span
            className={`size-2 shrink-0 rounded-full ${priorityDotClass[record.priority]}`}
            aria-hidden="true"
          />
          <span className="truncate text-sm font-medium text-foreground">
            {t(`tickets.priority.${record.priority}`)}
          </span>
        </div>
      </div>

      {/* 3. Category segment */}
      <div className="col-span-1 flex min-w-0 flex-col justify-center border-s border-border p-3 sm:border-t-0 sm:px-4 sm:py-2.5">
        <p className="text-xs font-medium text-muted-foreground">{t("tickets.category")}</p>
        <p
          className="mt-0.5 truncate text-sm font-medium text-foreground"
          title={categoryName}
        >
          {categoryName}
        </p>
      </div>

      {/* 4. Channel segment */}
      <div className="col-span-1 flex min-w-0 flex-col justify-center border-t border-border p-3 sm:border-s sm:border-t-0 sm:px-4 sm:py-2.5 lg:border-t-0">
        <p className="text-xs font-medium text-muted-foreground">{t("tickets.channelLabel")}</p>
        <p
          className="mt-0.5 truncate text-sm font-medium text-foreground"
          title={channelName}
        >
          {channelName}
        </p>
      </div>

      {/* 5. Followers segment */}
      <div className="col-span-1 flex min-w-0 flex-col justify-center border-s border-t border-border p-3 sm:border-t-0 sm:px-4 sm:py-2.5 lg:border-t-0">
        <p className="text-xs font-medium text-muted-foreground">{t("collaboration.followers")}</p>
        <div className="mt-0.5">
          <WatchToggle
            compact
            ticketId={record.id}
            watching={record.viewerIsWatching ?? false}
            watcherCount={record.watcherCount ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
