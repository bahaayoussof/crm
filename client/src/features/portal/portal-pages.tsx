import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppSelect, AppSelectField } from "@/components/ui/app-select";
import { useAuth } from "@/features/auth/auth-state";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { ConversationMessage, ConversationSection } from "@/features/tickets/ticket-conversation-ui";
import { AttachmentPanel, MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { usePortalTicketAttachments, useUploadPortalTicketAttachment } from "@/features/attachments/attachment-hooks";
import { portalTicketSchema, type PortalTicketForm } from "./portal.schemas";
import { useCreatePortalTicket, usePortalCategories, usePortalOverview, usePortalTicket, usePortalTickets, useReplyPortalTicket, useSubmitPortalFeedback } from "./portal-hooks";
import type { PortalTicket, PortalTicketDetail, PortalTicketStatus } from "./portal.types";
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

  const statusOptions = [
    { value: "", label: t("portal.allStatuses") },
    ...statuses.map((value) => ({ value, label: t(`portal.status.${value}`) })),
  ];

  return <PortalPage>
    <PortalPageHeader title={t("portal.myRequests")} description={t("portal.requestsDescription")} action={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.newRequest")}</Link>} />
    <section aria-label={t("portal.filters")} className="mt-5 grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
      <label className="block" htmlFor="portal-search"><span className="sr-only">{t("portal.search")}</span><input className="input" id="portal-search" value={search} onChange={(event) => update("search", event.target.value)} placeholder={t("portal.search")} /></label>
      <AppSelect
        id="portal-status"
        ariaLabel={t("portal.statusLabel")}
        value={status ?? ""}
        onValueChange={(val) => update("status", val)}
        options={statusOptions}
      />
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

  const categoryOptions = [
    { value: "", label: categories.isError ? t("portal.categoriesError") : t("portal.selectCategory") },
    ...(categories.data?.map((category) => ({ value: category.id, label: category.name })) ?? []),
  ];

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
        <Controller
          name="categoryId"
          control={form.control}
          render={({ field }) => (
            <AppSelectField
              id="portal-category"
              label={`${t("portal.category")} ${t("portal.optional")}`}
              labelClassName="mb-1.5 block text-sm font-medium"
              disabled={categories.isLoading || mutation.isPending}
              value={field.value}
              onValueChange={field.onChange}
              options={categoryOptions}
            />
          )}
        />
        <Field id="portal-description" label={t("portal.descriptionLabel")} error={form.formState.errors.description ? t("portal.validation.description") : undefined}><textarea aria-describedby={form.formState.errors.description ? "portal-description-error" : undefined} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-44 resize-y" id="portal-description" {...form.register("description")} /></Field>
      </div>
      {mutation.isError && <p className="mt-4 text-sm text-red-700" role="alert">{t("portal.createError")}</p>}
      <div className="mt-6 flex justify-end border-t pt-5"><button className="button-primary w-full sm:w-auto" disabled={mutation.isPending} type="submit">{mutation.isPending ? t("portal.creating") : t("portal.createAction")}</button></div>
    </form>
  </PortalPage>;
}

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg aria-hidden="true" className={`h-6 w-6 ${filled ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground"}`} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 20 20">
    <path d="M10 1.6l2.6 5.27 5.82.85-4.21 4.1.99 5.8L10 15.9l-5.2 2.73.99-5.8L1.58 8.72l5.82-.85z" strokeLinejoin="round" />
  </svg>
);

function StarRating({ name, value, onChange, readOnly }: { name: string; value: number; onChange?: (value: number) => void; readOnly?: boolean }) {
  const { t } = useTranslation();
  if (readOnly) {
    return <div aria-label={t("portal.feedback.ratingSummary", { rating: value })} className="flex items-center gap-1" role="img">
      {[1, 2, 3, 4, 5].map((star) => <StarIcon filled={star <= value} key={star} />)}
    </div>;
  }
  return <div aria-label={t("portal.feedback.ratingLabel")} className="flex items-center gap-1" role="radiogroup">
    {[1, 2, 3, 4, 5].map((star) => <label className="cursor-pointer rounded-sm p-0.5 [&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-primary/30" key={star}>
      <input checked={value === star} className="sr-only" name={name} onChange={() => onChange?.(star)} type="radio" value={star} />
      <span className="sr-only">{t("portal.feedback.starValue", { value: star })}</span>
      <StarIcon filled={star <= value} />
    </label>)}
  </div>;
}

function TicketFeedback({ ticket }: { ticket: PortalTicketDetail }) {
  const { t, i18n } = useTranslation();
  const mutation = useSubmitPortalFeedback(ticket.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRequired, setShowRequired] = useState(false);

  if (ticket.feedback) {
    return <section className="mt-7 max-w-3xl rounded-md border bg-white p-5">
      <h2 className="text-lg font-semibold">{t("portal.feedback.submittedTitle")}</h2>
      <div className="mt-3"><StarRating name="submitted-rating" readOnly value={ticket.feedback.rating} /></div>
      {ticket.feedback.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.feedback.comment}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{t("portal.feedback.submittedOn", { date: formatTicketDate(ticket.feedback.createdAt, i18n.language) })}</p>
    </section>;
  }
  if (!ticket.feedbackEligible) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (rating < 1) { setShowRequired(true); return; }
    await mutation.mutateAsync({ rating, comment: comment.trim() || undefined });
  };
  return <form className="mt-7 max-w-3xl rounded-md border bg-white p-5" onSubmit={submit}>
    <h2 className="text-lg font-semibold">{t("portal.feedback.title")}</h2>
    <p className="mt-1.5 text-sm text-muted-foreground">{t("portal.feedback.prompt")}</p>
    <div className="mt-4"><span className="mb-1.5 block text-sm font-medium">{t("portal.feedback.ratingLabel")}</span><StarRating name="feedback-rating" onChange={(value) => { setRating(value); setShowRequired(false); }} value={rating} /></div>
    {showRequired && <p className="mt-2 text-sm text-red-700" role="alert">{t("portal.feedback.ratingRequired")}</p>}
    <label className="mt-4 block" htmlFor="portal-feedback-comment"><span className="text-sm font-medium">{t("portal.feedback.commentLabel")}</span><textarea className="input mt-1.5 min-h-24 resize-y" id="portal-feedback-comment" maxLength={2000} onChange={(event) => setComment(event.target.value)} value={comment} /></label>
    {mutation.isError && <p className="mt-2 text-sm text-red-700" role="alert">{t("portal.feedback.error")}</p>}
    <div className="mt-4 flex justify-end"><button className="button-primary w-full sm:w-auto" disabled={mutation.isPending} type="submit">{mutation.isPending ? t("portal.feedback.submitting") : t("portal.feedback.submit")}</button></div>
  </form>;
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
  const closed = ticket.status === "CLOSED";
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!body.trim() || reply.isPending) return; await reply.mutateAsync(body); setBody(""); };
  const composer = closed ? (
    <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">{t("portal.closedNotice")}</p>
  ) : (
    <form onSubmit={send}>
      <h2 className="text-base font-semibold">{t("portal.reply")}</h2>
      {ticket.status === "RESOLVED" && <p className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">{t("portal.reopenNotice")}</p>}
      <label className="mt-3 block text-sm font-medium" htmlFor="portal-reply">{t("portal.replyLabel")}</label>
      <p className="mt-1 text-xs text-muted-foreground" id="portal-reply-help">{t("portal.replyHelp")}</p>
      <textarea aria-describedby="portal-reply-help" className="input mt-3 min-h-28 resize-y py-3" id="portal-reply" value={body} onChange={(event) => setBody(event.target.value)} />
      {reply.isError && <p className="mt-2 text-sm text-red-700" role="alert">{t("portal.replyError")}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button className="button-primary sm:ms-auto sm:w-auto" disabled={reply.isPending || !body.trim()}>{reply.isPending ? t("portal.sending") : t("portal.sendReply")}</button>
      </div>
    </form>
  );
  return <PortalPage>
    <Link className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/tickets">{t("portal.back")}</Link>
    <header className="mt-4 border-b pb-5">
      <TicketRef id={ticket.id} />
      <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{ticket.subject}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3"><PortalStatus status={ticket.status} /></div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
        <div><dt className="font-medium text-foreground">{t("portal.category")}</dt><dd>{ticket.category?.name ?? t("common.notProvided")}</dd></div>
        <div><dt className="font-medium text-foreground">{t("portal.created")}</dt><dd><bdi dir="ltr">{formatTicketDate(ticket.createdAt, i18n.language)}</bdi></dd></div>
        <div><dt className="font-medium text-foreground">{t("portal.updated")}</dt><dd><bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi></dd></div>
      </dl>
    </header>
    <div className="mt-6 space-y-6">
      <section className="rounded-md border bg-white p-5">
        <h2 className="text-base font-semibold">{t("portal.descriptionLabel")}</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{ticket.description}</p>
      </section>
      <ConversationSection
        heading={t("portal.conversation")}
        description={t("portal.conversationDescription")}
        timelineLabel={t("portal.timelineLabel")}
        isEmpty={ticket.messages.length === 0}
        emptyTitle={t("portal.noMessages")}
        footer={composer}
      >
        {ticket.messages.map((message) => (
          <ConversationMessage
            key={message.id}
            side={message.author.kind === "CUSTOMER" ? "start" : "end"}
            title={t(`portal.author.${message.author.kind}`)}
            timestamp={message.createdAt}
            language={i18n.language}
            body={message.body}
            attachmentsSlot={<MessageAttachmentList attachments={messageAttachments.get(message.id) ?? []} scope="portal" />}
          />
        ))}
      </ConversationSection>
      <section className="rounded-md border bg-white p-5">
        <AttachmentPanel attachments={ticketLevelAttachments} isLoading={attachments.isLoading} isError={attachments.isError} onRetry={() => attachments.refetch()} scope="portal" locale={i18n.language} canUpload={!closed} upload={{ mutateAsync: (file) => uploadAttachment.mutateAsync(file), isPending: uploadAttachment.isPending }} disabledReason={closed ? t("attachments.closedTicketUpload") : undefined} />
      </section>
      <TicketFeedback ticket={ticket} />
    </div>
  </PortalPage>;
}
