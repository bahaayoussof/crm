import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/shared/data-table/data-table-pagination";
import { DataTableEmptyRow } from "@/components/shared/data-table/data-table-empty";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { formatTicketDate, ticketReference } from "./ticket-format";
import type { TicketListItem } from "./ticket.types";

interface TicketTableProps {
  tickets: TicketListItem[];
  emptyMessage?: string;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
  /** Unassigned-queue view for an agent: render a per-row "Claim" action. */
  showClaim?: boolean;
  claimingId?: string | null;
  onClaim?: (ticketId: string) => void;
}

export function TicketTable({
  tickets,
  emptyMessage,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
  showClaim = false,
  claimingId = null,
  onClaim,
}: TicketTableProps) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<TicketListItem>[]>(
    () => [
      {
        id: "ticket",
        header: t("tickets.columns.ticket"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              className="line-clamp-1 break-words text-[12px] font-medium text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title={row.original.subject}
              to={`/tickets/${row.original.id}`}
            >
              {row.original.subject}
            </Link>
          </div>
        ),
      },
      {
        id: "customer",
        accessorKey: "customer.name",
        header: t("tickets.customer"),
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12px] font-medium text-foreground" title={row.original.customer.name}>
              {row.original.customer.name}
            </p>
            <p className="truncate text-[10px] text-muted-foreground" title={row.original.customer.email}>
              <bdi dir="ltr">{row.original.customer.email}</bdi>
            </p>
          </div>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: t("tickets.statusLabel"),
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        id: "priority",
        accessorKey: "priority",
        header: t("tickets.priorityLabel"),
        cell: ({ row }) => <TicketPriorityText priority={row.original.priority} />,
      },
      {
        id: "category",
        header: t("tickets.category"),
        cell: ({ row }) => (
          <span className="truncate text-[11px] text-foreground/80 font-normal" title={row.original.category?.name}>
            {row.original.category?.name ?? t("common.notProvided")}
          </span>
        ),
      },
      {
        id: "updated",
        accessorKey: "updatedAt",
        header: t("tickets.updated"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {formatTicketDate(row.original.updatedAt, i18n.language)}
          </span>
        ),
      },
      {
        id: "agent",
        header: () => <div className="text-center">{t("tickets.assignedAgent")}</div>,
        cell: ({ row }) =>
          showClaim && !row.original.assignedAgent ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => onClaim?.(row.original.id)}
                disabled={claimingId === row.original.id}
                className="button px-4 text-[11px] font-medium disabled:opacity-60 cursor-pointer"
              >
                {claimingId === row.original.id ? t("tickets.claiming") : t("tickets.claim")}
              </button>
            </div>
          ) : (
            <AssigneeCell
              name={row.original.assignedAgent?.name}
              unassignedLabel={t("tickets.unassigned")}
            />
          ),
      },
    ],
    [i18n.language, t, showClaim, claimingId, onClaim]
  );

  const pagination = useMemo<PaginationState>(
    () => ({ pageIndex: page - 1, pageSize }),
    [page, pageSize]
  );

  const table = useReactTable({
    data: tickets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (ticket) => ticket.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => changePage(updater, pagination, onPageChange),
  });

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table className="w-full">
          <colgroup>
            {table.getAllLeafColumns().map((column) => (
              <col key={column.id} className={columnClass(column.id)} />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <DataTableEmptyRow
                colSpan={table.getVisibleLeafColumns().length}
                message={emptyMessage}
              />
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card List */}
      <div className="divide-y divide-border-subtle bg-table-background md:hidden">
        {tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          tickets.map((ticket) => (
            <Link
              className="block p-3.5 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              to={`/tickets/${ticket.id}`}
              key={ticket.id}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <p className="font-medium text-[12px] text-foreground">{ticket.subject}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" title={ticket.id}>
                    <bdi dir="ltr">{ticketReference(ticket.id)}</bdi>
                  </p>
                </div>
                <TicketPriorityText priority={ticket.priority} />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticket.status} />
                <span className="text-[11px] text-muted-foreground">{ticket.customer.name}</span>
              </div>
              <p className="mt-2 border-t border-border-subtle pt-1.5 text-[10px] text-muted-foreground">
                {ticket.assignedAgent?.name ?? t("tickets.unassigned")} · {formatTicketDate(ticket.updatedAt, i18n.language)}
              </p>
            </Link>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            totalCount={totalCount}
            canPreviousPage={table.getCanPreviousPage()}
            canNextPage={table.getCanNextPage()}
            onPreviousPage={() => table.previousPage()}
            onNextPage={() => table.nextPage()}
            ariaLabel={t("tickets.pagination")}
          />
        </div>
      )}
    </>
  );
}

function changePage(
  updater: Updater<PaginationState>,
  current: PaginationState,
  onPageChange: (page: number) => void
) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}

function columnClass(id: string) {
  return (
    {
      ticket: "w-auto",
      customer: "w-[140px]",
      status: "w-[155px]",
      priority: "w-[90px]",
      category: "w-[120px]",
      agent: "w-[150px]",
      updated: "w-[170px]",
    }[id] ?? ""
  );
}
