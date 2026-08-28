import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { ArrowLeft, CheckCircle2, Clock, Inbox, Star } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppSelect, AppSelectField } from "@/components/ui/app-select";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { ConversationMessage, ConversationSection } from "@/features/tickets/ticket-conversation-ui";
import { AttachmentPanel, MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { usePortalTicketAttachments, useUploadPortalTicketAttachment } from "@/features/attachments/attachment-hooks";
import { portalTicketSchema, type PortalTicketForm } from "./portal.schemas";
import { useCreatePortalTicket, usePortalCategories, usePortalOverview, usePortalTicket, usePortalTickets, useReplyPortalTicket, useSubmitPortalFeedback } from "./portal-hooks";
import type { PortalOverview, PortalTicket, PortalTicketDetail, PortalTicketStatus, TicketPriority } from "./portal.types";
import { PortalPage, PortalState, PortalStatus, TicketRef } from "./portal-ui";
import { PortalTicketsTable } from "./portal-tickets-table";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DataTableFiltersPopover,
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";

const statuses: PortalTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_YOU", "RESOLVED", "CLOSED"];
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const errorCode = (error: unknown) => axios.isAxiosError(error) ? error.response?.data?.error?.code as string | undefined : undefined;

function TicketRows({ tickets }: { tickets: PortalTicket[] }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <Table className="min-w-[48rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">{t("portal.ticketId")}</TableHead>
              <TableHead className="w-auto">{t("portal.subject")}</TableHead>
              <TableHead className="w-36">{t("portal.statusLabel")}</TableHead>
              <TableHead className="w-36">{t("portal.category")}</TableHead>
              <TableHead className="w-44">{t("portal.created")}</TableHead>
              <TableHead className="w-44">{t("portal.updated")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell>
                  <TicketRef id={ticket.id} />
                </TableCell>
                <TableCell>
                  <Link
                    className="block break-words font-medium text-foreground hover:underline transition-colors focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to={`/portal/tickets/${ticket.id}`}
                  >
                    {ticket.subject}
                  </Link>
                </TableCell>
                <TableCell>
                  <PortalStatus status={ticket.status} />
                </TableCell>
                <TableCell
                  className="truncate text-xs text-muted-foreground"
                  title={ticket.category?.name}
                >
                  {ticket.category?.name ?? t("common.notProvided")}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  <bdi dir="ltr">{formatTicketDate(ticket.createdAt, i18n.language)}</bdi>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y divide-border-subtle bg-table-background md:hidden">
        {tickets.map((ticket) => (
          <Link
            className="block p-4 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            key={ticket.id}
            to={`/portal/tickets/${ticket.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <strong className="min-w-0 break-words text-sm font-semibold text-foreground">
                {ticket.subject}
              </strong>
              <PortalStatus status={ticket.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <TicketRef id={ticket.id} />
              <span>{ticket.category?.name ?? t("common.notProvided")}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("portal.updated")}: <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi>
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

const homeMetrics: { key: keyof PortalOverview["counts"]; icon: React.ReactNode; variant: "primary" | "warning" | "success" }[] = [
  { key: "open", icon: <Inbox className="size-4" aria-hidden="true" />, variant: "primary" },
  { key: "waitingForYou", icon: <Clock className="size-4" aria-hidden="true" />, variant: "warning" },
  { key: "resolved", icon: <CheckCircle2 className="size-4" aria-hidden="true" />, variant: "success" },
];

export function PortalHomePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const query = usePortalOverview();
  const nf = new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US");
  return <PortalPage>
    <PageHeader title={t("portal.welcome", { name: user?.name })} description={t("portal.homeDescription")} actions={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.createAction")}</Link>} />
    {query.isLoading ? (
      <div className="mt-6 space-y-8" data-testid="portal-overview-skeleton" aria-label={t("portal.loadingOverview")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {homeMetrics.map((metric) => <div className="h-[4.75rem] animate-pulse rounded-lg bg-muted" key={metric.key} />)}
        </div>
        <div className="h-52 animate-pulse rounded-lg bg-muted" />
      </div>
    ) : query.isError ? (
      <PortalState retry={() => query.refetch()}>{t("portal.overviewError")}</PortalState>
    ) : <>
      <section aria-label={t("portal.summary")} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {homeMetrics.map((metric) => (
          <MetricCard
            key={metric.key}
            label={t(`portal.metrics.${metric.key}`)}
            value={nf.format(query.data!.counts[metric.key])}
            icon={metric.icon}
            variant={metric.variant}
          />
        ))}
      </section>
      <section className="mt-8" aria-labelledby="recent-requests-title">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground" id="recent-requests-title">{t("portal.recent")}</h2>
          <Link className="rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/tickets">{t("portal.viewAll")}</Link>
        </div>
        {query.data!.recentTickets.length ? (
          <DataTableSurface>
            <TicketRows tickets={query.data!.recentTickets} />
          </DataTableSurface>
        ) : (
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden="true" />}
            title={t("portal.empty")}
            description={t("portal.emptyRecentHint")}
            action={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.createAction")}</Link>}
          />
        )}
      </section>
    </>}
  </PortalPage>;
}

export function PortalTicketsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const status = statuses.includes(params.get("status") as PortalTicketStatus)
    ? (params.get("status") as PortalTicketStatus)
    : undefined;
  const priority = priorities.includes(params.get("priority") as TicketPriority)
    ? (params.get("priority") as TicketPriority)
    : undefined;
  const categoryId = params.get("categoryId") || undefined;

  const query = usePortalTickets({ page, limit: 10, search: debouncedSearch, status, priority, categoryId });
  const categories = usePortalCategories();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };
  const clearFilterParams = () => {
    const next = new URLSearchParams(params);
    for (const key of ["status", "priority", "categoryId", "page"]) next.delete(key);
    setParams(next);
  };

  const activeFilterCount = [status, priority, categoryId].filter(Boolean).length;
  const hasAnyFilter = Boolean(debouncedSearch || activeFilterCount);

  const statusOptions = [
    { value: "", label: t("portal.allStatuses") },
    ...statuses.map((value) => ({ value, label: t(`portal.status.${value}`) })),
  ];
  const priorityOptions = [
    { value: "", label: t("portal.allPriorities") },
    ...priorities.map((value) => ({ value, label: t(`tickets.priority.${value}`) })),
  ];
  const categoryOptions = [
    { value: "", label: t("portal.allCategories") },
    ...(categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];

  return (
    <PortalPage>
      <PageHeader
        title={t("portal.myRequests")}
        description={t("portal.requestsDescription")}
        actions={<Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.newRequest")}</Link>}
      />
      <div className="mt-5">
        <DataTableSurface>
          <DataTableToolbar>
            <DataTableSearch
              id="portal-search"
              ariaLabel={t("portal.search")}
              value={search}
              onChange={(val) => update("search", val)}
              placeholder={t("portal.search")}
            />
            <div className="flex items-center gap-2 shrink-0 sm:ms-auto">
              <DataTableFiltersPopover
                title={t("portal.filters")}
                triggerLabel={t("portal.filters")}
                activeCount={activeFilterCount}
                onClearFilters={clearFilterParams}
                fields={[
                  {
                    id: "status",
                    label: t("portal.statusLabel"),
                    render: () => (
                      <AppSelect
                        ariaLabel={t("portal.statusLabel")}
                        value={status ?? ""}
                        onValueChange={(val) => update("status", val)}
                        options={statusOptions}
                      />
                    ),
                  },
                  {
                    id: "priority",
                    label: t("portal.priority"),
                    render: () => (
                      <AppSelect
                        ariaLabel={t("portal.priority")}
                        value={priority ?? ""}
                        onValueChange={(val) => update("priority", val)}
                        options={priorityOptions}
                      />
                    ),
                  },
                  {
                    id: "category",
                    label: t("portal.category"),
                    render: () => (
                      <AppSelect
                        ariaLabel={t("portal.category")}
                        value={categoryId ?? ""}
                        onValueChange={(val) => update("categoryId", val)}
                        options={categoryOptions}
                      />
                    ),
                  },
                ]}
              />
              {hasAnyFilter && (
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("portal.clearFilters")}
                </button>
              )}
            </div>
          </DataTableToolbar>
          {query.isLoading ? (
            <div className="p-4" aria-label={t("portal.loadingRequests")}>
              <DataTableSkeleton columns={6} />
            </div>
          ) : query.isError ? (
            <div className="p-6">
              <PortalState retry={() => query.refetch()}>{t("portal.requestsError")}</PortalState>
            </div>
          ) : query.data!.data.length ? (
            <PortalTicketsTable
              tickets={query.data!.data}
              page={page}
              pageSize={query.data!.meta.limit || 10}
              pageCount={query.data!.meta.totalPages || 0}
              totalCount={query.data!.meta.total}
              onPageChange={(next) => update("page", next > 1 ? String(next) : "")}
            />
          ) : (
            <div className="p-6">
              <EmptyState
                className="border-0 bg-transparent p-2"
                icon={<Inbox className="size-5" aria-hidden="true" />}
                title={hasAnyFilter ? t("portal.noMatchesTitle") : t("portal.empty")}
                description={hasAnyFilter ? t("portal.noMatches") : t("portal.emptyRecentHint")}
                action={hasAnyFilter ? undefined : <Link className="button-link w-full sm:w-auto" to="/portal/tickets/new">{t("portal.createAction")}</Link>}
              />
            </div>
          )}
        </DataTableSurface>
      </div>
    </PortalPage>
  );
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
    <PageHeader title={t("portal.newRequest")} description={t("portal.newDescription")} />
    <form className="mt-6 max-w-3xl rounded-lg border border-border bg-card p-5 sm:p-6" noValidate onSubmit={submit}>
      <div className="space-y-5">
        <Field id="portal-subject" label={t("portal.subject")} error={form.formState.errors.subject ? t("portal.validation.subject") : undefined}>
          <input aria-describedby={form.formState.errors.subject ? "portal-subject-error" : undefined} aria-invalid={Boolean(form.formState.errors.subject)} className="input" id="portal-subject" {...form.register("subject")} />
        </Field>
        <Controller
          name="categoryId"
          control={form.control}
          render={({ field }) => (
            <AppSelectField
              id="portal-category"
              label={`${t("portal.category")} ${t("portal.optional")}`}
              labelClassName="mb-1.5 block text-sm font-medium text-foreground"
              disabled={categories.isLoading || mutation.isPending}
              value={field.value}
              onValueChange={field.onChange}
              options={categoryOptions}
            />
          )}
        />
        <Field id="portal-description" label={t("portal.descriptionLabel")} error={form.formState.errors.description ? t("portal.validation.description") : undefined}>
          <textarea aria-describedby={form.formState.errors.description ? "portal-description-error" : undefined} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-44 resize-y" id="portal-description" {...form.register("description")} />
        </Field>
      </div>
      {mutation.isError && <p className="mt-4 text-sm text-danger" role="alert">{t("portal.createError")}</p>}
      <div className="mt-6 flex justify-end border-t border-border pt-5">
        <button className="button-primary w-full sm:w-auto" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? t("portal.creating") : t("portal.createAction")}
        </button>
      </div>
    </form>
  </PortalPage>;
}

const StarIcon = ({ filled }: { filled: boolean }) => (
  <Star
    aria-hidden="true"
    size={24}
    strokeWidth={1.5}
    className={`size-6 ${filled ? "fill-amber-400 text-amber-400" : "fill-none text-muted-foreground"}`}
  />
);

function StarRating({ name, value, onChange, readOnly }: { name: string; value: number; onChange?: (value: number) => void; readOnly?: boolean }) {
  const { t } = useTranslation();
  if (readOnly) {
    return (
      <div aria-label={t("portal.feedback.ratingSummary", { rating: value })} className="flex items-center gap-1" role="img">
        {[1, 2, 3, 4, 5].map((star) => <StarIcon filled={star <= value} key={star} />)}
      </div>
    );
  }
  return (
    <div aria-label={t("portal.feedback.ratingLabel")} className="flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((star) => (
        <label className="cursor-pointer rounded-sm p-0.5 [&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-primary/30" key={star}>
          <input checked={value === star} className="sr-only" name={name} onChange={() => onChange?.(star)} type="radio" value={star} />
          <span className="sr-only">{t("portal.feedback.starValue", { value: star })}</span>
          <StarIcon filled={star <= value} />
        </label>
      ))}
    </div>
  );
}

function TicketFeedback({ ticket }: { ticket: PortalTicketDetail }) {
  const { t, i18n } = useTranslation();
  const mutation = useSubmitPortalFeedback(ticket.id);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [showRequired, setShowRequired] = useState(false);

  if (ticket.feedback) {
    return (
      <section className="mt-7 max-w-3xl rounded-md border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{t("portal.feedback.submittedTitle")}</h2>
        <div className="mt-3"><StarRating name="submitted-rating" readOnly value={ticket.feedback.rating} /></div>
        {ticket.feedback.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{ticket.feedback.comment}</p>}
        <p className="mt-3 text-xs text-muted-foreground">{t("portal.feedback.submittedOn", { date: formatTicketDate(ticket.feedback.createdAt, i18n.language) })}</p>
      </section>
    );
  }
  if (!ticket.feedbackEligible) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mutation.isPending) return;
    if (rating < 1) { setShowRequired(true); return; }
    await mutation.mutateAsync({ rating, comment: comment.trim() || undefined });
  };
  return (
    <form className="mt-7 max-w-3xl rounded-md border border-border bg-card p-5" onSubmit={submit}>
      <h2 className="text-base font-semibold text-foreground">{t("portal.feedback.title")}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{t("portal.feedback.prompt")}</p>
      <div className="mt-4"><span className="mb-1.5 block text-sm font-medium text-foreground">{t("portal.feedback.ratingLabel")}</span><StarRating name="feedback-rating" onChange={(value) => { setRating(value); setShowRequired(false); }} value={rating} /></div>
      {showRequired && <p className="mt-2 text-sm text-danger" role="alert">{t("portal.feedback.ratingRequired")}</p>}
      <label className="mt-4 block" htmlFor="portal-feedback-comment"><span className="text-sm font-medium text-foreground">{t("portal.feedback.commentLabel")}</span><textarea className="input mt-1.5 min-h-24 resize-y" id="portal-feedback-comment" maxLength={2000} onChange={(event) => setComment(event.target.value)} value={comment} /></label>
      {mutation.isError && <p className="mt-2 text-sm text-danger" role="alert">{t("portal.feedback.error")}</p>}
      <div className="mt-4 flex justify-end"><button className="button-primary w-full sm:w-auto" disabled={mutation.isPending} type="submit">{mutation.isPending ? t("portal.feedback.submitting") : t("portal.feedback.submit")}</button></div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
      {children}
      {error && <p className="mt-1.5 text-sm text-danger" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

export function PortalTicketDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = usePortalTicket(id);
  const reply = useReplyPortalTicket(id);
  const attachments = usePortalTicketAttachments(id);
  const uploadAttachment = useUploadPortalTicketAttachment(id);
  const [body, setBody] = useState("");
  if (query.isLoading) return (
    <PortalPage>
      <div className="space-y-6" aria-label={t("portal.loadingDetail")}>
        <div className="space-y-3 border-b border-border pb-5">
          <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-28 animate-pulse rounded-md bg-muted" />
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    </PortalPage>
  );
  if (query.isError) return <PortalPage><PortalState retry={() => query.refetch()}>{errorCode(query.error) === "TICKET_NOT_FOUND" ? t("portal.notFound") : t("portal.detailError")}</PortalState></PortalPage>;
  const ticket = query.data!;
  const ticketLevelAttachments = attachments.data?.filter((item) => item.messageId === null) ?? [];
  const messageAttachments = new Map<string, NonNullable<typeof attachments.data>>();
  for (const item of attachments.data ?? []) if (item.messageId) messageAttachments.set(item.messageId, [...(messageAttachments.get(item.messageId) ?? []), item]);
  const closed = ticket.status === "CLOSED";
  const send = async (event: React.FormEvent) => { event.preventDefault(); if (!body.trim() || reply.isPending) return; await reply.mutateAsync(body); setBody(""); };
  const composer = closed ? (
    <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">{t("portal.closedNotice")}</p>
  ) : (
    <form onSubmit={send}>
      <h2 className="text-base font-semibold text-foreground">{t("portal.reply")}</h2>
      {ticket.status === "RESOLVED" && <p className="mt-2 rounded-md border border-primary/30 bg-primary-subtle p-3 text-sm text-primary">{t("portal.reopenNotice")}</p>}
      <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="portal-reply">{t("portal.replyLabel")}</label>
      <p className="mt-1 text-xs text-muted-foreground" id="portal-reply-help">{t("portal.replyHelp")}</p>
      <textarea aria-describedby="portal-reply-help" className="input mt-3 min-h-28 resize-y py-3" id="portal-reply" value={body} onChange={(event) => setBody(event.target.value)} />
      {reply.isError && <p className="mt-2 text-sm text-danger" role="alert">{t("portal.replyError")}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button className="button-primary sm:ms-auto sm:w-auto" disabled={reply.isPending || !body.trim()}>{reply.isPending ? t("portal.sending") : t("portal.sendReply")}</button>
      </div>
    </form>
  );
  return <PortalPage>
    <Link className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/tickets">
      <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
      <span>{t("portal.back")}</span>
    </Link>
    <header className="mt-4 border-b border-border pb-5">
      <TicketRef id={ticket.id} />
      <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere]">{ticket.subject}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3"><PortalStatus status={ticket.status} /></div>
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
        <div><dt className="font-medium text-foreground text-xs">{t("portal.category")}</dt><dd className="mt-0.5">{ticket.category?.name ?? t("common.notProvided")}</dd></div>
        <div><dt className="font-medium text-foreground text-xs">{t("portal.created")}</dt><dd className="mt-0.5"><bdi dir="ltr">{formatTicketDate(ticket.createdAt, i18n.language)}</bdi></dd></div>
        <div><dt className="font-medium text-foreground text-xs">{t("portal.updated")}</dt><dd className="mt-0.5"><bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi></dd></div>
      </dl>
    </header>
    <div className="mt-6 space-y-6">
      <section className="rounded-md border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{t("portal.descriptionLabel")}</h2>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{ticket.description}</p>
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
      <section className="rounded-md border border-border bg-card p-5">
        <AttachmentPanel attachments={ticketLevelAttachments} isLoading={attachments.isLoading} isError={attachments.isError} onRetry={() => attachments.refetch()} scope="portal" locale={i18n.language} canUpload={!closed} upload={{ mutateAsync: (file) => uploadAttachment.mutateAsync(file), isPending: uploadAttachment.isPending }} disabledReason={closed ? t("attachments.closedTicketUpload") : undefined} />
      </section>
      <TicketFeedback ticket={ticket} />
    </div>
  </PortalPage>;
}
