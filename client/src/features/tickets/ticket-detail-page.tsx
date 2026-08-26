import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { TicketPriorityText, TicketStatusBadge } from "./ticket-badges";
import { TicketConversation } from "./ticket-conversation";
import { getTicketError, getTicketErrorStatus } from "./ticket-error";
import { formatTicketDate, ticketReference } from "./ticket-format";
import { useAgents, useCategories, useTicket, useUpdateTicket } from "./ticket-hooks";
import type { SlaState, TicketDetail, TicketPriority, TicketStatus } from "./ticket.types";
import { TicketPage, TicketSkeleton, TicketState } from "./ticket-ui";
import { canCloseTicket, canManageTicketDefinition, canOperateAssignedTicket } from "./ticket-permissions";

const normalTransitions: Record<TicketStatus, TicketStatus[]> = { NEW: ["OPEN"], OPEN: ["IN_PROGRESS"], IN_PROGRESS: ["WAITING_CUSTOMER", "RESOLVED"], WAITING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"], RESOLVED: [], CLOSED: [], ESCALATED: [] };
export function TicketDetailPage() {
  const { t, i18n } = useTranslation(); const { id = "" } = useParams(); const { user } = useAuth(); const ticket = useTicket(id); const update = useUpdateTicket(id); const categories = useCategories(); const agents = useAgents();
  const [status, setStatus] = useState<TicketStatus | "">(""); const [priority, setPriority] = useState<TicketPriority | "">(""); const [categoryId, setCategoryId] = useState(""); const [assignedAgentId, setAssignedAgentId] = useState(""); const [error, setError] = useState<string | null>(null); const [confirmingClose, setConfirmingClose] = useState(false); const confirmCloseRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (ticket.data) { setStatus(ticket.data.status); setPriority(ticket.data.priority); setCategoryId(ticket.data.category?.id ?? ""); setAssignedAgentId(ticket.data.assignedAgent?.id ?? ""); } }, [ticket.data]);
  useEffect(() => { if (confirmingClose) confirmCloseRef.current?.focus(); }, [confirmingClose]);
  if (ticket.isLoading) return <TicketPage><TicketSkeleton /></TicketPage>;
  if (ticket.isError || !ticket.data) { const statusCode = getTicketErrorStatus(ticket.error); return <TicketPage><TicketState>{statusCode === 404 ? t("tickets.notFound") : statusCode === 403 ? t("tickets.unauthorized") : t("tickets.loadDetailError")} {statusCode !== 404 && statusCode !== 403 && <button className="button-secondary mt-4" onClick={() => ticket.refetch()}>{t("common.retry")}</button>}</TicketState></TicketPage>; }
  const record = ticket.data; const canManage = Boolean(user && canManageTicketDefinition(user.role)); const canWorkflow = Boolean(user && canOperateAssignedTicket(record, user)); const canClose = Boolean(user && canCloseTicket(record, user));
  const availableStatuses = [...normalTransitions[record.status], ...(canManage && ["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(record.status) ? ["ESCALATED" as TicketStatus] : []), ...(canManage && record.status === "ESCALATED" ? ["IN_PROGRESS" as TicketStatus] : [])];
  const saveOperations = async () => { setError(null); const changes: { status?: TicketStatus; priority?: TicketPriority; categoryId?: string | null; assignedAgentId?: string | null } = {};
    if (status && status !== record.status) changes.status = status; if (priority && priority !== record.priority) changes.priority = priority; if (canManage && categoryId !== (record.category?.id ?? "")) changes.categoryId = categoryId || null; if (canManage && assignedAgentId !== (record.assignedAgent?.id ?? "")) changes.assignedAgentId = assignedAgentId || null;
    if (!Object.keys(changes).length) return; try { await update.mutateAsync(changes); } catch (caught) { setError(getTicketError(caught, t("tickets.updateError"), t)); }
  };
  const closeTicket = async () => { setError(null); try { await update.mutateAsync({ status: "CLOSED" }); setConfirmingClose(false); } catch (caught) { setError(getTicketError(caught, t("tickets.closeError"), t)); } };
  return <TicketPage>
    <header className="border-b pb-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><Link className="text-sm font-medium text-primary" to="/tickets">{t("tickets.backToList")}</Link><p className="mt-4 text-xs text-muted-foreground" dir="ltr">{ticketReference(record.id)}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{record.subject}</h1><div className="mt-3 flex flex-wrap items-center gap-3"><TicketStatusBadge status={record.status} /><TicketPriorityText priority={record.priority} /><span className="text-xs text-muted-foreground">{t(`tickets.channel.${record.channel}`)}</span></div></div>{canManage && <Link className="button-secondary" to={`/tickets/${record.id}/edit`}>{t("common.edit")}</Link>}</div></header>
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6"><TicketConversation ticketId={record.id} items={record.conversation} canMutate={canWorkflow} /><section className="rounded-md border bg-white p-5"><h2 className="text-base font-semibold">{t("tickets.descriptionLabel")}</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{record.description}</p></section>
        <section className="rounded-md border bg-white"><div className="border-b px-5 py-4"><h2 className="text-base font-semibold">{t("tickets.history")}</h2></div>{record.history.length ? <ol className="divide-y">{record.history.map((event) => <li className="px-5 py-4" key={event.id}><div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><p className="text-sm font-medium">{t(`tickets.historyActions.${event.action}`, { defaultValue: event.action })}</p><time className="text-xs text-muted-foreground">{formatTicketDate(event.createdAt, i18n.language)}</time></div><p className="mt-1 text-xs text-muted-foreground">{event.actor?.name ?? t("tickets.systemActor")}{event.oldValue || event.newValue ? `: ${event.oldValue ? displayValue(event.oldValue, t) : t("common.notProvided")} → ${event.newValue ? displayValue(event.newValue, t) : t("common.notProvided")}` : ""}</p></li>)}</ol> : <p className="p-5 text-sm text-muted-foreground">{t("tickets.noHistory")}</p>}</section>
      </div>
      <aside className="space-y-5"><section className="rounded-md border bg-white p-5"><h2 className="text-base font-semibold">{t("tickets.operations")}</h2>{error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}{!canWorkflow && <p className="mt-3 rounded-md border bg-muted p-3 text-sm text-muted-foreground">{t("tickets.unassignedReadOnly")}</p>}{canWorkflow && <div className="mt-4 space-y-4">
        <Control label={t("tickets.statusLabel")}><select className="input" value={status} disabled={!canWorkflow || availableStatuses.length === 0} onChange={(event) => setStatus(event.target.value as TicketStatus)}><option value={record.status}>{t(`tickets.status.${record.status}`)}</option>{availableStatuses.filter((value) => value !== record.status).map((value) => <option value={value} key={value}>{t(`tickets.status.${value}`)}</option>)}</select></Control>
        <Control label={t("tickets.priorityLabel")}><select className="input" value={priority} disabled={!canWorkflow} onChange={(event) => setPriority(event.target.value as TicketPriority)}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option value={value} key={value}>{t(`tickets.priority.${value}`)}</option>)}</select></Control>
        {canManage && <Control label={t("tickets.category")}><select className="input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{t("common.notProvided")}</option>{categories.data?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Control>}
        {canManage && <Control label={t("tickets.assignedAgent")}><select className="input" value={assignedAgentId} onChange={(event) => setAssignedAgentId(event.target.value)}><option value="">{t("tickets.unassigned")}</option>{agents.data?.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></Control>}
        <button className="button-primary" disabled={update.isPending} onClick={saveOperations}>{update.isPending ? t("common.saving") : t("tickets.saveOperations")}</button></div>}{canClose && <div className="mt-5 border-t pt-5">{confirmingClose ? <div className="rounded-md border border-red-200 bg-red-50 p-4" role="group" aria-label={t("tickets.closeConfirmation")}><p className="text-sm text-red-900">{t("tickets.closeConfirmation")}</p><div className="mt-3 flex flex-wrap gap-2"><button ref={confirmCloseRef} className="button-primary bg-red-700 hover:bg-red-800" disabled={update.isPending} onClick={closeTicket}>{update.isPending ? t("tickets.closing") : t("tickets.confirmClose")}</button><button className="button-secondary" disabled={update.isPending} onClick={() => setConfirmingClose(false)}>{t("tickets.cancelClose")}</button></div></div> : <button className="button-secondary border-red-300 text-red-700" onClick={() => setConfirmingClose(true)}>{t("tickets.closeTicket")}</button>}</div>}</section>
        <section className="rounded-md border bg-white p-5"><h2 className="text-base font-semibold">{t("tickets.customer")}</h2><Link className="mt-3 block font-medium text-primary" to={`/customers/${record.customer.id}`}>{record.customer.name}</Link><p className="mt-1 text-sm text-muted-foreground"><bdi dir="ltr">{record.customer.email}</bdi></p>{record.customer.phone && <p className="text-sm text-muted-foreground"><bdi dir="ltr">{record.customer.phone}</bdi></p>}</section>
        <section className="rounded-md border bg-white p-5"><h2 className="text-base font-semibold">{t("tickets.metadata")}</h2><dl className="mt-3 space-y-3 text-sm"><Meta label={t("tickets.category")} value={record.category?.name ?? t("common.notProvided")} /><Meta label={t("tickets.assignedAgent")} value={record.assignedAgent?.name ?? t("tickets.unassigned")} /><Meta label={t("tickets.created")} value={<DateValue value={record.createdAt} language={i18n.language} />} /><Meta label={t("tickets.updated")} value={<DateValue value={record.updatedAt} language={i18n.language} />} /></dl><SlaDetails record={record} language={i18n.language} /></section>
      </aside>
    </div>
  </TicketPage>;
}
function Control({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-medium">{label}</span><span className="mt-2 block">{children}</span></label>; }
function SlaDetails({ record, language }: { record: TicketDetail; language: string }) {
  const { t } = useTranslation();
  return <section className="mt-5 border-t pt-4" aria-labelledby="ticket-sla-heading">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold" id="ticket-sla-heading">{t("tickets.sla.title")}</h3><SlaStateLabel state={record.slaState} /></div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(`tickets.sla.explanations.${record.slaState}`)}</p>
    <dl className="mt-4 space-y-3 text-sm">
      {record.effectiveSlaTarget && <Meta label={t("tickets.sla.activeTarget")} value={t(`tickets.sla.targets.${record.effectiveSlaTarget}`)} />}
      {record.effectiveSlaDueAt && <Meta label={t("tickets.sla.effectiveDue")} value={<DateValue value={record.effectiveSlaDueAt} language={language} />} />}
      <Meta label={t("tickets.firstResponseDue")} value={record.firstResponseDueAt ? <DateValue value={record.firstResponseDueAt} language={language} /> : t("common.notProvided")} />
      <Meta label={t("tickets.sla.firstRespondedAt")} value={record.firstRespondedAt ? <DateValue value={record.firstRespondedAt} language={language} /> : t("tickets.sla.awaitingFirstResponse")} />
      <Meta label={t("tickets.resolutionDue")} value={record.resolutionDueAt ? <DateValue value={record.resolutionDueAt} language={language} /> : t("common.notProvided")} />
    </dl>
  </section>;
}
function SlaStateLabel({ state }: { state: SlaState }) {
  const { t } = useTranslation();
  const styles: Record<SlaState, string> = {
    BREACHED: "border-red-300 bg-red-50 text-red-800",
    AT_RISK: "border-amber-300 bg-amber-50 text-amber-900",
    ON_TRACK: "border-emerald-300 bg-emerald-50 text-emerald-800",
    MET: "border-green-200 bg-green-50 text-green-800",
    NOT_CONFIGURED: "border-gray-300 bg-gray-50 text-gray-700",
  };
  return <span className={`inline-flex rounded-sm border px-2 py-0.5 text-xs font-semibold ${styles[state]}`}>{t(`tickets.sla.states.${state}`)}</span>;
}
function DateValue({ value, language }: { value: string; language: string }) { return <time dateTime={value}><bdi dir="ltr">{formatTicketDate(value, language)}</bdi></time>; }
function Meta({ label, value }: { label: string; value: React.ReactNode }) { return <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words sm:text-end">{value}</dd></div>; }
function displayValue(value: string, t: TFunction) { if (["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"].includes(value)) return t(`tickets.status.${value}`); if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value)) return t(`tickets.priority.${value}`); return value; }
