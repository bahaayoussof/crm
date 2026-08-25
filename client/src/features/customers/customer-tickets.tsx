import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TicketPriorityText, TicketStatusBadge } from "@/features/tickets/ticket-badges";
import { formatTicketDate, ticketReference } from "@/features/tickets/ticket-format";
import { useCustomerTickets } from "./customer-hooks";
import { LoadingRows, StatePanel } from "./customer-ui";
import type { CustomerTicketSummary } from "./customer.types";

export function CustomerTickets({ customerId }: { customerId: string }) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const tickets = useCustomerTickets(customerId, page);
  if (tickets.isLoading) return <LoadingRows />;
  if (tickets.isError) return <StatePanel action={<button className="button-secondary" onClick={() => tickets.refetch()}>{t("common.retry")}</button>}>{t("customers.ticketsLoadError")}</StatePanel>;
  const records = tickets.data?.data ?? [];
  if (!records.length) return <StatePanel>{t("customers.noTickets")}</StatePanel>;
  const meta = tickets.data?.meta;
  return <>
    <div className="hidden overflow-x-auto rounded-md border bg-white md:block"><table className="w-full min-w-[58rem] text-sm"><thead className="border-b bg-muted/70 text-xs text-muted-foreground"><tr><th className="px-3 py-3 text-start">{t("tickets.columns.id")}</th><th className="px-3 py-3 text-start">{t("tickets.columns.ticket")}</th><th className="px-3 py-3 text-start">{t("tickets.statusLabel")}</th><th className="px-3 py-3 text-start">{t("tickets.priorityLabel")}</th><th className="px-3 py-3 text-start">{t("tickets.category")}</th><th className="px-3 py-3 text-start">{t("tickets.assignedAgent")}</th><th className="px-3 py-3 text-start">{t("tickets.updated")}</th></tr></thead><tbody className="divide-y">{records.map((ticket) => <TicketRow ticket={ticket} locale={i18n.language} key={ticket.id} />)}</tbody></table></div>
    <div className="divide-y rounded-md border bg-white md:hidden">{records.map((ticket) => <TicketCard ticket={ticket} locale={i18n.language} key={ticket.id} />)}</div>
    {(meta?.totalPages ?? 0) > 1 && <nav className="mt-6 flex items-center justify-between gap-3" aria-label={t("customers.ticketPagination")}><button className="button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t("common.previous")}</button><span className="text-sm text-muted-foreground">{t("tickets.page", { page, total: meta?.totalPages })}</span><button className="button-secondary" disabled={page >= (meta?.totalPages ?? 0)} onClick={() => setPage((value) => value + 1)}>{t("common.next")}</button></nav>}
  </>;
}

function TicketRow({ ticket, locale }: { ticket: CustomerTicketSummary; locale: string }) {
  const { t } = useTranslation();
  return <tr><td className="px-3 py-3 font-mono text-xs text-muted-foreground"><bdi dir="ltr">{ticketReference(ticket.id)}</bdi></td><td className="px-3 py-3"><TicketSubject ticket={ticket} /><AccessLabel ticket={ticket} /></td><td className="px-3 py-3"><TicketStatusBadge status={ticket.status} /></td><td className="px-3 py-3"><TicketPriorityText priority={ticket.priority} /></td><td className="px-3 py-3">{ticket.category?.name ?? t("common.notProvided")}</td><td className="px-3 py-3">{ticket.assignedAgent?.name ?? t("tickets.unassigned")}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{formatTicketDate(ticket.updatedAt, locale)}</td></tr>;
}

function TicketCard({ ticket, locale }: { ticket: CustomerTicketSummary; locale: string }) {
  const { t } = useTranslation();
  const content = <><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{ticket.subject}</p><p className="mt-1 font-mono text-xs text-muted-foreground"><bdi dir="ltr">{ticketReference(ticket.id)}</bdi></p></div><TicketPriorityText priority={ticket.priority} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><TicketStatusBadge status={ticket.status} /><span className="text-xs text-muted-foreground">{ticket.assignedAgent?.name ?? t("tickets.unassigned")}</span></div><AccessLabel ticket={ticket} /><p className="mt-3 border-t pt-2 text-xs text-muted-foreground">{formatTicketDate(ticket.updatedAt, locale)}</p></>;
  return ticket.access === "FULL" ? <Link className="block p-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30" to={`/tickets/${ticket.id}`}>{content}</Link> : <article className="p-4">{content}</article>;
}

function TicketSubject({ ticket }: { ticket: CustomerTicketSummary }) { return ticket.access === "FULL" ? <Link className="font-semibold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to={`/tickets/${ticket.id}`}>{ticket.subject}</Link> : <span className="font-semibold">{ticket.subject}</span>; }
function AccessLabel({ ticket }: { ticket: CustomerTicketSummary }) { const { t } = useTranslation(); return ticket.access === "SUMMARY_ONLY" ? <p className="mt-1 text-xs font-medium text-muted-foreground">{t("customers.ticketSummaryOnly")}</p> : null; }
