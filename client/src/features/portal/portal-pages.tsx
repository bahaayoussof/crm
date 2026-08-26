import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { AttachmentPanel, MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { usePortalTicketAttachments, useUploadPortalTicketAttachment } from "@/features/attachments/attachment-hooks";
import { portalTicketSchema, type PortalTicketForm } from "./portal.schemas";
import { useCreatePortalTicket, usePortalCategories, usePortalOverview, usePortalTicket, usePortalTickets, useReplyPortalTicket } from "./portal-hooks";
import type { PortalTicket, PortalTicketStatus } from "./portal.types";
import { PortalPage, PortalPageHeader, PortalState, PortalStatus, TicketRef } from "./portal-ui";

const statuses: PortalTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_YOU", "RESOLVED", "CLOSED"];
const errorCode = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.error?.code as string | undefined : undefined;

function TicketRows({ tickets }: { tickets: PortalTicket[] }) {
  const { t, i18n } = useTranslation();
  return <>
    <div className="mt-4 hidden overflow-hidden rounded-md border bg-white md:block">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b bg-muted/60 text-xs font-semibold text-muted-foreground">
          <tr>
            <th className="w-32 px-4 py-3 text-start">{t("portal.ticketId")}</th>
            <th className="px-4 py-3 text-start">{t("portal.subject")}</th>
            <th className="w-36 px-4 py-3 text-start">{t("portal.statusLabel")}</th>
            <th className="w-36 px-4 py-3 text-start">{t("portal.category")}</th>
            <th className="w-44 px-4 py-3 text-start">{t("portal.created")}</th>
            <th className="w-44 px-4 py-3 text-start">{t("portal.updated")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {tickets.map((ticket) => <tr className="transition-colors hover:bg-muted/35 focus-within:bg-muted/35" key={ticket.id}>
            <td className="px-4 py-3"><TicketRef id={ticket.id} /></td>
            <td className="px-4 py-3"><Link className="block break-words font-semibold text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to={`/portal/tickets/${ticket.id}`}>{ticket.subject}</Link></td>
            <td className="px-4 py-3"><PortalStatus status={ticket.status} /></td>
            <td className="truncate px-4 py-3 text-muted-foreground" title={ticket.category?.name}>{ticket.category?.name ?? t("common.notProvided")}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground"><bdi dir="ltr">{formatTicketDate(ticket.createdAt, i18n.language)}</bdi></td>
            <td className="px-4 py-3 text-xs text-muted-foreground"><bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <div className="mt-4 grid gap-3 md:hidden">
      {tickets.map((ticket) => <Link className="rounded-md border bg-white p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" key={ticket.id} to={`/portal/tickets/${ticket.id}`}>
        <div className="flex items-start justify-between gap-3"><strong className="min-w-0 break-words text-sm">{ticket.subject}</strong><PortalStatus status={ticket.status} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><TicketRef id={ticket.id} /><span>{ticket.category?.name ?? t("common.notProvided")}</span></div>
        <p className="mt-2 text-xs text-muted-foreground">{t("portal.updated")}: <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi></p>
      </Link>)}
    </div>
  </>;
}

export function PortalHomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const query = usePortalOverview();
  return <PortalPage>
    <PortalPageHeader title={t("portal.welcome", { name: user?.name })} description={t("portal.homeDescription")} action={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.createAction")}</Link>} />
    {query.isLoading ? <PortalState>{t("portal.loadingOverview")}</PortalState> : query.isError ? <PortalState retry={() => query.refetch()}>{t("portal.overviewError")}</PortalState> : <>
      <section aria-label={t("portal.summary")} className="mt-6 grid overflow-hidden rounded-md border bg-white sm:grid-cols-3 sm:divide-x sm:divide-x-reverse">
        {[["open", query.data!.counts.open], ["waitingForYou", query.data!.counts.waitingForYou], ["resolved", query.data!.counts.resolved]].map(([key, count]) => <div className="border-b px-5 py-4 last:border-b-0 sm:border-b-0" key={key}>
          <strong className="text-2xl font-semibold tabular-nums">{new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US").format(count as number)}</strong>
          <p className="mt-1 text-sm text-muted-foreground">{t(`portal.metrics.${key}`)}</p>
        </div>)}
      </section>
      <section className="mt-8" aria-labelledby="recent-requests-title">
        <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold" id="recent-requests-title">{t("portal.recent")}</h2><Link className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/tickets">{t("portal.viewAll")}</Link></div>
        {query.data!.recentTickets.length ? <TicketRows tickets={query.data!.recentTickets} /> : <PortalState>{t("portal.empty")}</PortalState>}
      </section>
    </>}
  </PortalPage>;
}

export function PortalTicketsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") ?? "";
  const status = (params.get("status") || undefined) as PortalTicketStatus | undefined;
  const query = usePortalTickets({ page, limit: 10, search, status });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };
  return <PortalPage>
    <PortalPageHeader title={t("portal.myRequests")} description={t("portal.requestsDescription")} action={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.newRequest")}</Link>} />
    <section aria-label={t("portal.filters")} className="mt-5 grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <label className="block" htmlFor="portal-search"><span className="sr-only">{t("portal.search")}</span><input className="input" id="portal-search" value={search} onChange={(event) => update("search", event.target.value)} placeholder={t("portal.search")} /></label>
      <label className="block" htmlFor="portal-status"><span className="sr-only">{t("portal.statusLabel")}</span><select className="input" id="portal-status" value={status ?? ""} onChange={(event) => update("status", event.target.value)}><option value="">{t("portal.allStatuses")}</option>{statuses.map((value) => <option key={value} value={value}>{t(`portal.status.${value}`)}</option>)}</select></label>
    </section>
    {query.isLoading ? <PortalState>{t("portal.loadingRequests")}</PortalState> : query.isError ? <PortalState retry={() => query.refetch()}>{t("portal.requestsError")}</PortalState> : query.data!.data.length ? <>
      <TicketRows tickets={query.data!.data} />
      <nav aria-label={t("portal.pagination")} className="mt-5 flex items-center justify-between gap-3"><button className="button-secondary" disabled={page <= 1} onClick={() => update("page", String(page - 1))}>{t("common.previous")}</button><span className="text-center text-sm text-muted-foreground">{t("portal.page", { page, total: query.data!.meta.totalPages || 1 })}</span><button className="button-secondary" disabled={page >= query.data!.meta.totalPages} onClick={() => update("page", String(page + 1))}>{t("common.next")}</button></nav>
    </> : <PortalState>{search || status ? t("portal.noMatches") : t("portal.empty")}</PortalState>}
  </PortalPage>;
}

export function PortalNewTicketPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const categories = usePortalCategories();
  const mutation = useCreatePortalTicket();
  const form = useForm<PortalTicketForm>({ resolver: zodResolver(portalTicketSchema), defaultValues: { subject: "", categoryId: "", description: "" } });
  const submit = form.handleSubmit(async (values) => {
    if (mutation.isPending) return;
    const ticket = await mutation.mutateAsync({ ...values, categoryId: values.categoryId || null });
    navigate(`/portal/tickets/${ticket.id}`);
  });
  return <PortalPage>
    <PortalPageHeader title={t("portal.newRequest")} description={t("portal.newDescription")} />
    <form className="mt-6 max-w-3xl rounded-md border bg-white p-5 sm:p-6" noValidate onSubmit={submit}>
      <div className="space-y-5">
        <Field id="portal-subject" label={t("portal.subject")} error={form.formState.errors.subject ? t("portal.validation.subject") : undefined}><input aria-describedby={form.formState.errors.subject ? "portal-subject-error" : undefined} aria-invalid={Boolean(form.formState.errors.subject)} className="input" id="portal-subject" {...form.register("subject")} /></Field>
        <Field id="portal-category" label={`${t("portal.category")} ${t("portal.optional")}`}><select className="input" disabled={categories.isLoading || categories.isError || mutation.isPending} id="portal-category" {...form.register("categoryId")}><option value="">{categories.isError ? t("portal.categoriesError") : t("portal.selectCategory")}</option>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <Field id="portal-description" label={t("portal.descriptionLabel")} error={form.formState.errors.description ? t("portal.validation.description") : undefined}><textarea aria-describedby={form.formState.errors.description ? "portal-description-error" : undefined} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-44 resize-y" id="portal-description" {...form.register("description")} /></Field>
      </div>
      {mutation.isError && <p className="mt-4 text-sm text-red-700" role="alert">{t("portal.createError")}</p>}
      <div className="mt-6 flex justify-end border-t pt-5"><button className="button-primary w-full sm:w-auto" disabled={mutation.isPending} type="submit">{mutation.isPending ? t("portal.creating") : t("portal.createAction")}</button></div>
    </form>
  </PortalPage>;
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  const errorId = `${id}-error`;
  return <div><label className="mb-1.5 block text-sm font-medium" htmlFor={id}>{label}</label>{children}{error && <p className="mt-1.5 text-sm text-red-700" id={errorId} role="alert">{error}</p>}</div>;
}

export function PortalTicketDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = usePortalTicket(id);
  const reply = useReplyPortalTicket(id);
  const attachments = usePortalTicketAttachments(id);
  const uploadAttachment = useUploadPortalTicketAttachment(id);
  const [body, setBody] = useState("");
  if (query.isLoading) return <PortalPage><PortalState>{t("portal.loadingDetail")}</PortalState></PortalPage>;
  if (query.isError) return <PortalPage><PortalState retry={() => query.refetch()}>{errorCode(query.error) === "TICKET_NOT_FOUND" ? t("portal.notFound") : t("portal.detailError")}</PortalState></PortalPage>;
  const ticket = query.data!;
  const ticketLevelAttachments = attachments.data?.filter((item) => item.messageId === null) ?? [];
  const messageAttachments = new Map<string, NonNullable<typeof attachments.data>>();
  for (const item of attachments.data ?? []) if (item.messageId) messageAttachments.set(item.messageId, [...(messageAttachments.get(item.messageId) ?? []), item]);
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!body.trim() || reply.isPending) return; await reply.mutateAsync(body); setBody(""); };
  return <PortalPage>
    <Link className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/tickets">{t("portal.back")}</Link>
    <header className="mt-4 border-b pb-5"><TicketRef id={ticket.id} /><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{ticket.subject}</h1><PortalStatus status={ticket.status} /></div><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6">{ticket.description}</p><dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground"><div><dt className="font-medium text-foreground">{t("portal.category")}</dt><dd>{ticket.category?.name ?? t("common.notProvided")}</dd></div><div><dt className="font-medium text-foreground">{t("portal.created")}</dt><dd><bdi dir="ltr">{formatTicketDate(ticket.createdAt, i18n.language)}</bdi></dd></div><div><dt className="font-medium text-foreground">{t("portal.updated")}</dt><dd><bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi></dd></div></dl></header>
    <section className="mt-7"><h2 className="text-lg font-semibold">{t("portal.conversation")}</h2>{ticket.messages.length ? <ol className="mt-4 max-w-3xl space-y-3">{ticket.messages.map((message) => <li className="rounded-md border bg-white p-4" key={message.id}><div className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground"><strong className="text-foreground">{t(`portal.author.${message.author.kind}`)}</strong><time><bdi dir="ltr">{formatTicketDate(message.createdAt, i18n.language)}</bdi></time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p><MessageAttachmentList attachments={messageAttachments.get(message.id) ?? []} scope="portal" /></li>)}</ol> : <PortalState>{t("portal.noMessages")}</PortalState>}</section>
    <section className="mt-7 max-w-3xl"><AttachmentPanel attachments={ticketLevelAttachments} isLoading={attachments.isLoading} isError={attachments.isError} onRetry={() => attachments.refetch()} scope="portal" locale={i18n.language} canUpload={ticket.status !== "CLOSED"} upload={{ mutateAsync: (file) => uploadAttachment.mutateAsync(file), isPending: uploadAttachment.isPending }} disabledReason={ticket.status === "CLOSED" ? t("attachments.closedTicketUpload") : undefined} /></section>
    {ticket.status === "CLOSED" ? <p className="mt-7 max-w-3xl rounded-md border bg-muted p-4 text-sm">{t("portal.closedNotice")}</p> : <form className="mt-7 max-w-3xl border-t pt-6" onSubmit={send}><h2 className="text-lg font-semibold">{t("portal.reply")}</h2>{ticket.status === "RESOLVED" && <p className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">{t("portal.reopenNotice")}</p>}<label className="mt-4 block" htmlFor="portal-reply"><span className="text-sm font-medium">{t("portal.replyLabel")}</span><textarea aria-describedby="reply-help" className="input mt-1.5 min-h-32 resize-y" id="portal-reply" value={body} onChange={(event) => setBody(event.target.value)} /><span className="mt-1.5 block text-xs text-muted-foreground" id="reply-help">{t("portal.replyHelp")}</span></label>{reply.isError && <p className="mt-2 text-sm text-red-700" role="alert">{t("portal.replyError")}</p>}<div className="mt-4 flex justify-end"><button className="button-primary w-full sm:w-auto" disabled={reply.isPending || !body.trim()}>{reply.isPending ? t("portal.sending") : t("portal.sendReply")}</button></div></form>}
  </PortalPage>;
}
