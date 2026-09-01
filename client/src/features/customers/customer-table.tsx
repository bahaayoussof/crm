import { type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/shared/data-table";
import { formatDate, formatNumber } from "./customer-format";
import type { CustomerListItem } from "./customer.types";

interface CustomerTableProps {
  customers: CustomerListItem[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount?: number;
  onPageChange: (page: number) => void;
}

const COLUMN_WIDTHS: Record<string, string> = {
  name: "w-[22%]",
  email: "w-auto",
  phone: "w-[160px]",
  openTickets: "w-[110px]",
  totalTickets: "w-[110px]",
  lastInteraction: "w-[180px]",
};

const COLUMN_CLASSES: Record<string, string> = {
  name: "font-semibold",
  openTickets: "tabular-nums",
  totalTickets: "tabular-nums",
  lastInteraction: "whitespace-nowrap text-xs text-muted-foreground",
  email: "text-muted-foreground",
  phone: "text-muted-foreground",
};

export function CustomerTable({
  customers,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
}: CustomerTableProps) {
  const { t, i18n } = useTranslation();
  const columns = useMemo<ColumnDef<CustomerListItem>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("customers.name"),
        cell: ({ row }) => (
          <Link
            className="block truncate rounded-sm font-semibold text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to={`/customers/${row.original.id}`}
            title={row.original.name}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "email",
        accessorKey: "email",
        header: t("customers.email"),
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return (
            <bdi className="block truncate text-muted-foreground" title={val} dir="ltr">
              {val}
            </bdi>
          );
        },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: t("customers.phone"),
        cell: ({ getValue }) => {
          const phone = getValue<string | null>();
          return phone ? (
            <bdi className="block truncate text-muted-foreground" title={phone} dir="ltr">
              {phone}
            </bdi>
          ) : (
            <span className="text-muted-foreground">{t("common.notProvided")}</span>
          );
        },
      },
      {
        id: "openTickets",
        accessorKey: "openTicketCount",
        header: t("customers.openTickets"),
        cell: ({ getValue }) => (
          <span className="font-medium text-foreground">
            {formatNumber(getValue<number>(), i18n.language)}
          </span>
        ),
      },
      {
        id: "totalTickets",
        accessorKey: "totalTicketCount",
        header: t("customers.totalTickets"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatNumber(getValue<number>(), i18n.language)}
          </span>
        ),
      },
      {
        id: "lastInteraction",
        accessorKey: "lastInteractionAt",
        header: t("customers.lastInteraction"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDate(getValue<string>(), i18n.language)}
          </span>
        ),
      },
    ],
    [i18n.language, t]
  );

  return (
    <DataTable
      surface={false}
      data={customers}
      columns={columns}
      getRowId={(customer) => customer.id}
      columnWidths={COLUMN_WIDTHS}
      columnClasses={COLUMN_CLASSES}
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        ariaLabel: t("customers.pagination"),
      }}
      renderMobileCard={(customer) => (
        <Link
          className="block p-4 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          to={`/customers/${customer.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-foreground">{customer.name}</p>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {t("customers.openCount", {
                count: formatNumber(customer.openTicketCount, i18n.language),
              })}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <bdi dir="ltr">{customer.email}</bdi>
          </p>
          {customer.phone && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              <bdi dir="ltr">{customer.phone}</bdi>
            </p>
          )}
          <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
            {t("customers.lastInteraction")}: {formatDate(customer.lastInteractionAt, i18n.language)}
          </p>
        </Link>
      )}
    />
  );
}
