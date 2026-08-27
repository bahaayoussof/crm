import { useState } from "react";
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
import { DataTableSurface } from "@/components/shared/data-table/data-table-surface";
import { DataTablePagination } from "@/components/shared/data-table/data-table-pagination";
import { TicketPriorityText, TicketStatusBadge } from "@/features/tickets/ticket-badges";
import { formatTicketDate, ticketReference } from "@/features/tickets/ticket-format";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { useCustomerTickets } from "./customer-hooks";
import { LoadingRows, StatePanel } from "./customer-ui";
import type { CustomerTicketSummary } from "./customer.types";

export function CustomerTickets({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const tickets = useCustomerTickets(customerId, page);
  if (tickets.isLoading) return <LoadingRows />;
  if (tickets.isError)
    return (
      <StatePanel
        action={
          <button className="button-secondary" onClick={() => tickets.refetch()}>
            {t("common.retry")}
          </button>
        }
      >
        {t("customers.ticketsLoadError")}
      </StatePanel>
    );
  const records = tickets.data?.data ?? [];
  if (!records.length) return <StatePanel>{t("customers.noTickets")}</StatePanel>;
  const meta = tickets.data?.meta;

  return (
    <DataTableSurface>
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[58rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{t("tickets.columns.id")}</TableHead>
              <TableHead className="w-auto">{t("tickets.columns.ticket")}</TableHead>
              <TableHead className="w-36">{t("tickets.statusLabel")}</TableHead>
              <TableHead className="w-28">{t("tickets.priorityLabel")}</TableHead>
              <TableHead className="w-36">{t("tickets.category")}</TableHead>
              <TableHead className="w-44">{t("tickets.assignedAgent")}</TableHead>
              <TableHead className="w-40">{t("tickets.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((ticket) => (
              <TicketRow ticket={ticket} locale={i18n.language} key={ticket.id} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="divide-y divide-border-subtle bg-table-background md:hidden">
        {records.map((ticket) => (
          <TicketCard ticket={ticket} locale={i18n.language} key={ticket.id} />
        ))}
      </div>

      {(meta?.totalPages ?? 0) > 1 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageCount={meta?.totalPages ?? 1}
            pageSize={meta?.limit ?? 20}
            totalCount={meta?.total}
            canPreviousPage={page > 1}
            canNextPage={page < (meta?.totalPages ?? 1)}
            onPreviousPage={() => setPage((v) => Math.max(1, v - 1))}
            onNextPage={() => setPage((v) => v + 1)}
            ariaLabel={t("customers.ticketPagination")}
          />
        </div>
      )}
    </DataTableSurface>
  );
}

function TicketRow({
  ticket,
  locale,
}: {
  ticket: CustomerTicketSummary;
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-medium text-muted-foreground">
        <bdi dir="ltr">{ticketReference(ticket.id)}</bdi>
      </TableCell>
      <TableCell>
        <TicketSubject ticket={ticket} />
        <AccessLabel ticket={ticket} />
      </TableCell>
      <TableCell>
        <TicketStatusBadge status={ticket.status} />
      </TableCell>
      <TableCell>
        <TicketPriorityText priority={ticket.priority} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {ticket.category?.name ?? t("common.notProvided")}
      </TableCell>
      <TableCell>
        <AssigneeCell
          name={ticket.assignedAgent?.name}
          unassignedLabel={t("tickets.unassigned")}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatTicketDate(ticket.updatedAt, locale)}
      </TableCell>
    </TableRow>
  );
}

function TicketCard({
  ticket,
  locale,
}: {
  ticket: CustomerTicketSummary;
  locale: string;
}) {
  const { t } = useTranslation();
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{ticket.subject}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            <bdi dir="ltr">{ticketReference(ticket.id)}</bdi>
          </p>
        </div>
        <TicketPriorityText priority={ticket.priority} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TicketStatusBadge status={ticket.status} />
        <span className="text-xs text-muted-foreground">
          {ticket.assignedAgent?.name ?? t("tickets.unassigned")}
        </span>
      </div>
      <AccessLabel ticket={ticket} />
      <p className="mt-3 border-t border-border-subtle pt-2 text-xs text-muted-foreground">
        {formatTicketDate(ticket.updatedAt, locale)}
      </p>
    </>
  );
  return ticket.access === "FULL" ? (
    <Link
      className="block p-4 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      to={`/tickets/${ticket.id}`}
    >
      {content}
    </Link>
  ) : (
    <article className="p-4">{content}</article>
  );
}

function TicketSubject({ ticket }: { ticket: CustomerTicketSummary }) {
  return ticket.access === "FULL" ? (
    <Link
      className="font-medium text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to={`/tickets/${ticket.id}`}
    >
      {ticket.subject}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{ticket.subject}</span>
  );
}

function AccessLabel({ ticket }: { ticket: CustomerTicketSummary }) {
  const { t } = useTranslation();
  return ticket.access === "SUMMARY_ONLY" ? (
    <p className="mt-1 text-xs font-medium text-muted-foreground">
      {t("customers.ticketSummaryOnly")}
    </p>
  ) : null;
}
