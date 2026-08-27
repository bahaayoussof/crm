import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { formatTicketDate, ticketReference } from "./ticket-format";
import type { TicketListItem } from "./ticket.types";

export function TicketTable({ tickets, emptyMessage, page, pageSize, pageCount, onPageChange }: { tickets: TicketListItem[]; emptyMessage?: string; page: number; pageSize: number; pageCount: number; onPageChange: (page: number) => void }) {
  const { t, i18n } = useTranslation();
  const columns = useMemo<ColumnDef<TicketListItem>[]>(() => [
    { id: "id", accessorKey: "id", header: t("tickets.columns.id"), cell: ({ row }) => <span className="font-mono text-xs font-medium text-primary" title={row.original.id}><bdi dir="ltr">{ticketReference(row.original.id)}</bdi></span> },
    { id: "ticket", header: t("tickets.columns.ticket"), cell: ({ row }) => <div className="min-w-0"><Link className="line-clamp-2 break-words font-medium text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" title={row.original.subject} to={`/tickets/${row.original.id}`}>{row.original.subject}</Link></div> },
    { id: "customer", accessorKey: "customer.name", header: t("tickets.customer"), cell: ({ row }) => <div className="min-w-0"><p className="truncate text-foreground font-medium" title={row.original.customer.name}>{row.original.customer.name}</p><p className="truncate text-xs text-muted-foreground" title={row.original.customer.email}><bdi dir="ltr">{row.original.customer.email}</bdi></p></div> },
    { id: "status", accessorKey: "status", header: t("tickets.statusLabel"), cell: ({ row }) => <TicketStatusBadge status={row.original.status} /> },
    { id: "priority", accessorKey: "priority", header: t("tickets.priorityLabel"), cell: ({ row }) => <TicketPriorityText priority={row.original.priority} /> },
    { id: "category", header: t("tickets.category"), cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.category?.name ?? t("common.notProvided")}</span> },
    { id: "agent", header: t("tickets.assignedAgent"), cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.assignedAgent?.name ?? t("tickets.unassigned")}</span> },
    { id: "updated", accessorKey: "updatedAt", header: t("tickets.updated"), cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatTicketDate(row.original.updatedAt, i18n.language)}</span> },
  ], [i18n.language, t]);
  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
  const table = useReactTable({ data: tickets, columns, getCoreRowModel: getCoreRowModel(), getRowId: (ticket) => ticket.id, manualPagination: true, pageCount, state: { pagination }, onPaginationChange: (updater) => changePage(updater, pagination, onPageChange) });
  return <>
    <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface shadow-subtle md:block">
      <table className="w-full min-w-[68rem] table-fixed text-sm">
        <thead className="border-b border-border bg-surface-subtle text-xs text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th className={`px-3.5 py-3 text-start font-semibold ${columnClass(header.column.id)}`} scope="col" key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td className="px-4 py-12 text-center text-sm text-muted-foreground" colSpan={table.getVisibleLeafColumns().length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr className="transition-colors hover:bg-surface-hover focus-within:bg-surface-hover" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td className={`px-3.5 py-3 ${columnClass(cell.column.id)} ${cell.column.id === "updated" ? "whitespace-nowrap text-xs text-muted-foreground" : ""}`} key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface shadow-subtle md:hidden">
      {tickets.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        tickets.map((ticket) => (
          <Link className="block p-4 transition hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30" to={`/tickets/${ticket.id}`} key={ticket.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{ticket.subject}</p>
                <p className="mt-1 font-mono text-xs text-primary" title={ticket.id}>
                  <bdi dir="ltr">{ticketReference(ticket.id)}</bdi>
                </p>
              </div>
              <TicketPriorityText priority={ticket.priority} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              <span className="text-xs text-muted-foreground">{ticket.customer.name}</span>
            </div>
            <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
              {ticket.assignedAgent?.name ?? t("tickets.unassigned")} · {formatTicketDate(ticket.updatedAt, i18n.language)}
            </p>
          </Link>
        ))
      )}
    </div>
    {pageCount > 1 && (
      <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("tickets.pagination")}>
        <button className="button-secondary" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
          {t("common.previous")}
        </button>
        <span className="text-xs font-medium text-muted-foreground">{t("tickets.page", { page, total: pageCount })}</span>
        <button className="button-secondary" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
          {t("common.next")}
        </button>
      </nav>
    )}
  </>;
}
function changePage(updater: Updater<PaginationState>, current: PaginationState, onPageChange: (page: number) => void) { const next = typeof updater === "function" ? updater(current) : updater; if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1); }
function columnClass(id: string) {
  const width = { id: "w-28", ticket: "w-[28rem]", customer: "w-64", status: "w-40", priority: "w-28", category: "w-40", agent: "w-44", updated: "w-44" }[id] ?? "";
  if (["category", "agent"].includes(id)) return `${width} hidden lg:table-cell`;
  if (id === "updated") return `${width} hidden xl:table-cell`;
  return width;
}
