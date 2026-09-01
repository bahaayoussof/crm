import { type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/shared/data-table";
import { TicketPriorityText } from "@/features/tickets/ticket-badges";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import type { PortalTicket, TicketPriority } from "./portal.types";
import { PortalStatus, TicketRef } from "./portal-ui";

type PortalTicketRow = PortalTicket & { priority?: TicketPriority };

interface PortalTicketsTableProps {
  tickets: PortalTicketRow[];
  emptyMessage?: string;
  /** "My Requests" exposes the customer-safe priority column; the compact
   * "Recent requests" list on the Portal home omits it. Never an internal-only field. */
  showPriority?: boolean;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

const COLUMN_WIDTHS: Record<string, string> = {
  subject: "w-auto",
  status: "w-[160px]",
  priority: "w-[100px]",
  category: "w-[140px]",
  updated: "w-[160px]",
};

/**
 * Customer "My Requests" table. Delegates layout / rows / pagination to the
 * shared {@link DataTable}; only the columns are portal-specific. Deliberately
 * omits every internal-only column (customer, assignee, channel, SLA).
 */
export function PortalTicketsTable({
  tickets,
  emptyMessage,
  showPriority = true,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
}: PortalTicketsTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<PortalTicketRow>[]>(
    () => [
      {
        id: "subject",
        header: t("portal.subject"),
        cell: ({ row }) => (
          <Link
            className="line-clamp-1 break-words text-[12px] font-medium text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title={row.original.subject}
            to={`/portal/tickets/${row.original.id}`}
          >
            {row.original.subject}
          </Link>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("portal.statusLabel"),
        cell: ({ row }) => <PortalStatus status={row.original.status} />,
      },
      ...(showPriority
        ? [{
            id: "priority",
            accessorKey: "priority",
            header: t("portal.priority"),
            cell: ({ row }) =>
              row.original.priority ? <TicketPriorityText priority={row.original.priority} /> : null,
          } as ColumnDef<PortalTicketRow>]
        : []),
      {
        id: "category",
        header: t("portal.category"),
        cell: ({ row }) => (
          <span className="truncate text-[11px] text-foreground/80" title={row.original.category?.name}>
            {row.original.category?.name ?? t("common.notProvided")}
          </span>
        ),
      },
      {
        id: "updated",
        accessorKey: "updatedAt",
        header: t("portal.updated"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            <bdi dir="ltr">{formatTicketDate(row.original.updatedAt, i18n.language)}</bdi>
          </span>
        ),
      },
    ],
    [i18n.language, t, showPriority],
  );

  return (
    <DataTable
      surface={false}
      data={tickets}
      columns={columns}
      getRowId={(ticket) => ticket.id}
      columnWidths={COLUMN_WIDTHS}
      emptyMessage={emptyMessage}
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        ariaLabel: t("portal.pagination"),
      }}
      renderMobileCard={(ticket) => (
        <Link
          className="block p-3.5 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
          to={`/portal/tickets/${ticket.id}`}
        >
          <div className="flex items-start justify-between gap-2.5">
            <strong className="min-w-0 break-words text-[12px] font-semibold text-foreground">
              {ticket.subject}
            </strong>
            {showPriority && ticket.priority && <TicketPriorityText priority={ticket.priority} />}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <PortalStatus status={ticket.status} />
            <span className="text-[11px] text-muted-foreground">
              {ticket.category?.name ?? t("common.notProvided")}
            </span>
          </div>
          <p className="mt-2 border-t border-border-subtle pt-1.5 text-[10px] text-muted-foreground">
            <TicketRef id={ticket.id} /> · {t("portal.updated")}:{" "}
            <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi>
          </p>
        </Link>
      )}
    />
  );
}
