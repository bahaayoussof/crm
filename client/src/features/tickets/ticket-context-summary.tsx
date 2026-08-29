import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Globe, Tag } from "lucide-react";
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

/** One compact strip segment. The Customer segment omits `label` (avatar + name
 * carry it); the field segments keep a muted label above a stronger value. */
function Cell({
  label,
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 px-4 py-3 sm:px-5 ${className}`}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
      <div className={`${label ? "mt-1 " : ""}text-sm text-foreground`}>{children}</div>
    </div>
  );
}

/** Icon + value, used by the Priority / Category / Channel segments so they scan
 * uniformly. `icon` is either a small lucide glyph or a coloured status dot. */
function FieldValue({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/**
 * Compact context bar under the ticket header: Customer | Priority | Category |
 * Channel | Followers, split by thin separators. It is the page's contextual
 * summary — Status lives in the header, editable properties + SLA in the rail,
 * so nothing here is repeated elsewhere.
 */
export function TicketContextSummary({ record }: { record: TicketDetail }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-col divide-y divide-border rounded-lg border border-border bg-card text-card-foreground shadow-subtle sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
      <Cell className="sm:flex-[1.6]">
        <div className="flex items-start gap-2.5">
          <span
            className="inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full bg-surface-secondary text-xs font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {initialsOf(record.customer.name)}
          </span>
          <div className="min-w-0">
            <Link
              className="block break-words font-semibold text-foreground hover:underline [overflow-wrap:anywhere]"
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
        <FieldValue
          icon={
            <span
              className={`size-2 shrink-0 rounded-full ${priorityDotClass[record.priority]}`}
              aria-hidden="true"
            />
          }
        >
          {t(`tickets.priority.${record.priority}`)}
        </FieldValue>
      </Cell>

      <Cell label={t("tickets.category")} className="sm:flex-1">
        <FieldValue
          icon={<Tag className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
        >
          {record.category?.name ?? t("common.notProvided")}
        </FieldValue>
      </Cell>

      <Cell label={t("tickets.channelLabel")} className="sm:flex-1">
        <FieldValue
          icon={<Globe className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
        >
          {t(`tickets.channel.${record.channel}`)}
        </FieldValue>
      </Cell>

      <Cell label={t("collaboration.followers")} className="sm:flex-1">
        <WatchToggle
          compact
          ticketId={record.id}
          watching={record.viewerIsWatching ?? false}
          watcherCount={record.watcherCount ?? 0}
        />
      </Cell>
    </div>
  );
}
