import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type PaginationState, type Updater } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { formatDate, formatNumber } from "./customer-format";
import type { CustomerListItem } from "./customer.types";

interface CustomerTableProps {
  customers: CustomerListItem[];
  page: number;
  pageSize: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

const columnClasses: Record<string, string> = {
  name: "",
  email: "",
  phone: "hidden xl:table-cell",
  openTickets: "hidden lg:table-cell",
  totalTickets: "hidden xl:table-cell",
  lastInteraction: "",
};

export function CustomerTable({ customers, page, pageSize, pageCount, onPageChange }: CustomerTableProps) {
  const { t, i18n } = useTranslation();
  const columns = useMemo<ColumnDef<CustomerListItem>[]>(() => [
    {
      id: "name",
      accessorKey: "name",
      header: t("customers.name"),
      cell: ({ row }) => <Link className="rounded-sm font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to={`/customers/${row.original.id}`}>{row.original.name}</Link>,
    },
    {
      id: "email",
      accessorKey: "email",
      header: t("customers.email"),
      cell: ({ getValue }) => <bdi dir="ltr">{getValue<string>()}</bdi>,
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: t("customers.phone"),
      cell: ({ getValue }) => {
        const phone = getValue<string | null>();
        return phone ? <bdi dir="ltr">{phone}</bdi> : <span>{t("common.notProvided")}</span>;
      },
    },
    {
      id: "openTickets",
      accessorKey: "openTicketCount",
      header: t("customers.openTickets"),
      cell: ({ getValue }) => formatNumber(getValue<number>(), i18n.language),
    },
    {
      id: "totalTickets",
      accessorKey: "totalTicketCount",
      header: t("customers.totalTickets"),
      cell: ({ getValue }) => formatNumber(getValue<number>(), i18n.language),
    },
    {
      id: "lastInteraction",
      accessorKey: "lastInteractionAt",
      header: t("customers.lastInteraction"),
      cell: ({ getValue }) => formatDate(getValue<string>(), i18n.language),
    },
  ], [i18n.language, t]);
  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
  const table = useReactTable({
    data: customers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (customer) => customer.id,
    manualPagination: true,
    pageCount,
    state: { pagination },
    onPaginationChange: (updater) => handlePaginationChange(updater, pagination, onPageChange),
  });

  return <>
    <div className="hidden overflow-x-auto rounded-md border bg-white md:block">
      <table className="w-full min-w-[44rem] text-start text-sm">
        <thead className="border-b bg-muted/70 text-xs text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th className={`px-4 py-3 text-start font-semibold ${columnClasses[header.column.id] ?? ""}`} scope="col" key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}
        </thead>
        <tbody className="divide-y">
          {table.getRowModel().rows.map((row) => <tr className="transition-colors hover:bg-muted/55 focus-within:bg-muted/55" key={row.id}>{row.getVisibleCells().map((cell) => <td className={`px-4 py-3.5 ${cellClassName(cell.column.id)} ${columnClasses[cell.column.id] ?? ""}`} key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
    <div className="divide-y rounded-md border bg-white md:hidden">
      {customers.map((customer) => <Link className="block p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30" to={`/customers/${customer.id}`} key={customer.id}><div className="flex items-start justify-between gap-3"><p className="font-semibold">{customer.name}</p><span className="shrink-0 text-xs text-muted-foreground">{t("customers.openCount", { count: formatNumber(customer.openTicketCount, i18n.language) })}</span></div><p className="mt-1 text-sm text-muted-foreground"><bdi dir="ltr">{customer.email}</bdi></p>{customer.phone && <p className="mt-0.5 text-sm text-muted-foreground"><bdi dir="ltr">{customer.phone}</bdi></p>}<p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{t("customers.lastInteraction")}: {formatDate(customer.lastInteractionAt, i18n.language)}</p></Link>)}
    </div>
    {pageCount > 1 && <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("customers.pagination")}><button className="button-secondary" type="button" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>{t("common.previous")}</button><span className="text-center text-sm text-muted-foreground">{t("customers.page", { page: formatNumber(page, i18n.language), total: formatNumber(pageCount, i18n.language) })}</span><button className="button-secondary" type="button" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>{t("common.next")}</button></nav>}
  </>;
}

function handlePaginationChange(updater: Updater<PaginationState>, current: PaginationState, onPageChange: (page: number) => void) {
  const next = typeof updater === "function" ? updater(current) : updater;
  if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex + 1);
}

function cellClassName(columnId: string) {
  if (columnId === "name") return "font-semibold";
  if (columnId === "openTickets" || columnId === "totalTickets") return "tabular-nums";
  if (columnId === "lastInteraction") return "whitespace-nowrap text-muted-foreground";
  return "text-muted-foreground";
}
