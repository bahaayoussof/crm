import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { CalendarClock, CheckCircle2, ChevronDown, Clock, Inbox, Paperclip, Star, Tag } from "lucide-react";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppSelect, AppSelectField } from "@/components/ui/app-select";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { ConversationMessage, ConversationSection } from "@/features/tickets/ticket-conversation-ui";
import { AttachmentCompactGrid, MessageAttachmentList } from "@/features/attachments/attachment-ui";
import { FileUploadModal } from "@/components/shared/file-upload";
import { TicketReplyEditor, type TicketReplyEditorHandle } from "@/features/tickets/ticket-reply-editor";
import { usePortalTicketAttachments, useUploadPortalTicketAttachment } from "@/features/attachments/attachment-hooks";
import { portalTicketSchema, type PortalTicketForm } from "./portal.schemas";
import { useCreatePortalTicket, usePortalCategories, usePortalOverview, usePortalTicket, usePortalTickets, useReplyPortalTicket, useSubmitPortalFeedback } from "./portal-hooks";
import type { PortalOverview, PortalTicketDetail, PortalTicketStatus, TicketPriority } from "./portal.types";
import { PortalPage, PortalStatus } from "./portal-ui";
import { PortalTicketsTable } from "./portal-tickets-table";
import { PageHeader } from "@/components/shared/page-header";
import { TicketDetailHeader, TicketDetailSection, TicketDetailSkeleton } from "@/features/tickets/ticket-detail-header";
import {
  TicketFormActions,
  TicketFormError,
  TicketFormField,
  TicketFormSection,
  TicketFormShell,
} from "@/features/tickets/ticket-form-shell";
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
        <DataTableSurface>
          <div className="p-4"><DataTableSkeleton columns={5} /></div>
        </DataTableSurface>
      </div>
    ) : query.isError ? (
      <EmptyState
        className="mt-6"
        title={t("portal.overviewError")}
        action={<button type="button" className="button-secondary" onClick={() => query.refetch()}>{t("common.retry")}</button>}
      />
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
            <PortalTicketsTable
              tickets={query.data!.recentTickets}
              showPriority={false}
              page={1}
              pageSize={query.data!.recentTickets.length || 1}
              pageCount={0}
              onPageChange={() => {}}
            />
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
              <EmptyState
                className="border-0 bg-transparent p-2"
                title={t("portal.requestsError")}
                action={<button type="button" className="button-secondary" onClick={() => query.refetch()}>{t("common.retry")}</button>}
              />
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
    <TicketFormShell className="mt-6" onSubmit={submit}>
      {mutation.isError && <TicketFormError>{t("portal.createError")}</TicketFormError>}
      <TicketFormSection titleId="portal-request-details-heading" title={t("portal.requestDetails")} bordered={false}>
        <TicketFormField id="portal-subject" label={t("portal.subject")} error={form.formState.errors.subject ? t("portal.validation.subject") : undefined}>
          <input aria-describedby={form.formState.errors.subject ? "portal-subject-error" : undefined} aria-invalid={Boolean(form.formState.errors.subject)} className="input" id="portal-subject" {...form.register("subject")} />
        </TicketFormField>
        <Controller
          name="categoryId"
          control={form.control}
          render={({ field }) => (
            <AppSelectField
              id="portal-category"
              label={`${t("portal.category")} ${t("portal.optional")}`}
              labelClassName="block text-sm font-medium text-foreground"
              disabled={categories.isLoading || mutation.isPending}
              value={field.value}
              onValueChange={field.onChange}
              options={categoryOptions}
            />
          )}
        />
        <TicketFormField id="portal-description" label={t("portal.descriptionLabel")} error={form.formState.errors.description ? t("portal.validation.description") : undefined}>
          <textarea aria-describedby={form.formState.errors.description ? "portal-description-error" : undefined} aria-invalid={Boolean(form.formState.errors.description)} className="input min-h-44 resize-y" id="portal-description" {...form.register("description")} />
        </TicketFormField>
      </TicketFormSection>
      <TicketFormActions>
        <Link className="button-secondary" to="/portal/tickets">{t("common.cancel")}</Link>
        <button className="button-primary w-auto" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? t("portal.creating") : t("portal.createAction")}
        </button>
      </TicketFormActions>
    </TicketFormShell>
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
      <TicketDetailSection className="w-full">
        <h2 className="text-sm font-semibold text-foreground">{t("portal.feedback.submittedTitle")}</h2>
        <div className="mt-3"><StarRating name="submitted-rating" readOnly value={ticket.feedback.rating} /></div>
        {ticket.feedback.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">{ticket.feedback.comment}</p>}
        <p className="mt-3 text-xs text-muted-foreground">{t("portal.feedback.submittedOn", { date: formatTicketDate(ticket.feedback.createdAt, i18n.language) })}</p>
      </TicketDetailSection>
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
    <TicketDetailSection className="w-full">
      <form onSubmit={submit}>
        <h2 className="text-sm font-semibold text-foreground">{t("portal.feedback.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("portal.feedback.prompt")}</p>
        <div className="mt-3.5"><span className="mb-1 block text-xs font-medium text-foreground">{t("portal.feedback.ratingLabel")}</span><StarRating name="feedback-rating" onChange={(value) => { setRating(value); setShowRequired(false); }} value={rating} /></div>
        {showRequired && <p className="mt-2 text-xs text-danger" role="alert">{t("portal.feedback.ratingRequired")}</p>}
        <label className="mt-3 block" htmlFor="portal-feedback-comment"><span className="text-xs font-medium text-foreground">{t("portal.feedback.commentLabel")}</span><textarea className="input mt-1 min-h-20 resize-y text-xs" id="portal-feedback-comment" maxLength={2000} onChange={(event) => setComment(event.target.value)} value={comment} /></label>
        {mutation.isError && <p className="mt-2 text-xs text-danger" role="alert">{t("portal.feedback.error")}</p>}
        <div className="mt-3 flex justify-end"><button className="button-primary w-full sm:w-auto text-xs" disabled={mutation.isPending} type="submit">{mutation.isPending ? t("portal.feedback.submitting") : t("portal.feedback.submit")}</button></div>
      </form>
    </TicketDetailSection>
  );
}

/** Right sidebar ticket details: Category, full Description, Created & Updated timestamps. */
function PortalTicketSidebar({
  ticket,
  locale,
  collapsible = false,
}: {
  ticket: PortalTicketDetail;
  locale: string;
  collapsible?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const iconClass = "size-3.5 shrink-0 text-muted-foreground";

  const content = (
    <div className="space-y-3.5 text-sm">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("portal.category")}</p>
        <div className="mt-1 flex items-center gap-1.5 font-medium text-foreground">
          <Tag className={iconClass} strokeWidth={1.75} aria-hidden="true" />
          <span className="min-w-0 truncate text-xs sm:text-sm">{ticket.category?.name ?? t("common.notProvided")}</span>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground" id="portal-sidebar-desc-label">{t("portal.descriptionLabel")}</p>
        <p
          className="mt-1 whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]"
          aria-labelledby="portal-sidebar-desc-label"
        >
          {ticket.description}
        </p>
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-medium text-muted-foreground">{t("portal.created")}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
          <CalendarClock className={iconClass} strokeWidth={1.75} aria-hidden="true" />
          <bdi dir="ltr">{formatTicketDate(ticket.createdAt, locale)}</bdi>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("portal.updated")}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
          <CalendarClock className={iconClass} strokeWidth={1.75} aria-hidden="true" />
          <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, locale)}</bdi>
        </div>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <section className="overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-start font-medium text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <span className="text-sm font-semibold">{t("portal.requestDetails")}</span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {open && <div className="border-t border-border px-4 py-3.5">{content}</div>}
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle"
      aria-label={t("portal.requestDetails")}
    >
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-foreground">{t("portal.requestDetails")}</h2>
      </div>
      <div className="p-4 sm:p-5">{content}</div>
    </section>
  );
}

const ATTACHMENTS_PREVIEW_COUNT = 3;

/** Attachments list inside the workspace tab panel */
function PortalAttachmentsTabContent({
  attachments,
  isLoading,
  isError,
  onRetry,
  locale,
  canUpload = false,
  onUpload,
}: {
  attachments: { id: string; fileName: string; mimeType: string; createdAt: string }[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  locale: string;
  canUpload?: boolean;
  onUpload?: () => void;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasMore = attachments.length > ATTACHMENTS_PREVIEW_COUNT;
  const visible = showAll ? attachments : attachments.slice(0, ATTACHMENTS_PREVIEW_COUNT);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("common.loading")}
      </p>
    );
  }
  if (isError) {
    return (
      <div
        className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground"
        role="alert"
      >
        {t("attachments.loadError")}{" "}
        <button type="button" className="button-secondary mt-2" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </div>
    );
  }
  if (attachments.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("attachments.none")}</p>
        {canUpload && onUpload && (
          <button
            type="button"
            className="button-secondary inline-flex items-center gap-1.5 min-h-9 px-3 text-xs w-full sm:w-auto"
            onClick={onUpload}
          >
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <span>{t("attachments.attachFile")}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${showAll ? "lg:max-h-[20rem] lg:overflow-y-auto" : ""}`}>
      {canUpload && onUpload && (
        <div className="flex justify-end">
          <button
            type="button"
            className="button-secondary inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1 text-xs"
            onClick={onUpload}
          >
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <span>{t("attachments.attachFile")}</span>
          </button>
        </div>
      )}
      <AttachmentCompactGrid attachments={visible} scope="portal" locale={locale} />
      {hasMore && (
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? t("attachments.showLess") : t("attachments.viewAll")}
        </button>
      )}
    </div>
  );
}

/** Unified lower workspace tabs: Reply & Attachments */
function PortalWorkspaceTabs({
  ticket,
  reply,
  attachments,
  attachmentsLoading,
  attachmentsError,
  onRetryAttachments,
  locale,
  onSent,
  onAttachFile,
}: {
  ticket: PortalTicketDetail;
  reply: ReturnType<typeof useReplyPortalTicket>;
  attachments: { id: string; fileName: string; mimeType: string; createdAt: string }[];
  attachmentsLoading: boolean;
  attachmentsError: boolean;
  onRetryAttachments: () => void;
  locale: string;
  onSent: () => void;
  onAttachFile?: () => void;
  attachMode?: boolean;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"reply" | "attachments">("reply");
  const editorRef = useRef<TicketReplyEditorHandle>(null);
  const [text, setText] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reply.isPending || !editorRef.current?.hasText()) return;
    try {
      await reply.mutateAsync(editorRef.current?.getHtml() ?? "");
      editorRef.current?.clear();
      setText("");
      onSent();
    } catch {
      /* surfaced via reply.isError below */
    }
  };

  const tabs: { value: "reply" | "attachments"; label: string; count?: number }[] = [
    { value: "reply", label: t("portal.reply") },
    { value: "attachments", label: t("attachments.title"), count: attachments.length },
  ];

  return (
    <section
      className="overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle"
      aria-label={t("portal.requestDetails")}
    >
      <div
        className="flex w-full border-b border-border px-3 sm:px-5"
        role="tablist"
        aria-label={t("portal.requestDetails")}
      >
        {tabs.map(({ value, label, count }) => (
          <button
            type="button"
            role="tab"
            key={value}
            aria-selected={tab === value}
            className={`-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === value
                ? "border-foreground font-semibold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(value)}
          >
            <span>{label}</span>
            {typeof count === "number" && count > 0 && (
              <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
        {/* Reply tab panel - kept mounted with hidden so Lexical draft survives tab switches */}
        <div role="tabpanel" hidden={tab !== "reply"} className={tab === "reply" ? "space-y-3" : "hidden"}>
          {ticket.status === "CLOSED" ? (
            <p className="rounded-md border border-border bg-surface-secondary/40 p-3 text-sm text-muted-foreground">
              {t("portal.closedNotice")}
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{t("portal.reply")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground" id="portal-reply-help">
                  {t("portal.replyHelp")}
                </p>
              </div>
              {ticket.status === "RESOLVED" && (
                <p className="rounded-md border border-primary/30 bg-primary-subtle p-2.5 text-xs sm:text-sm text-primary">
                  {t("portal.reopenNotice")}
                </p>
              )}
              <TicketReplyEditor
                ref={editorRef}
                id="portal-reply"
                ariaLabel={t("portal.replyLabel")}
                ariaDescribedBy="portal-reply-help"
                placeholder={t("portal.replyPlaceholder")}
                disabled={reply.isPending}
                onTextChange={setText}
              />
              {reply.isError && (
                <p className="text-sm text-danger" role="alert">
                  {t("portal.replyError")}
                </p>
              )}
              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                <div className="sm:me-auto">
                  <button
                    type="button"
                    className="button-secondary inline-flex items-center gap-1.5 w-full sm:w-auto"
                    onClick={() => onAttachFile?.()}
                  >
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    <span>{t("attachments.attachFile")}</span>
                  </button>
                </div>
                <button
                  type="submit"
                  className="button-primary sm:ms-auto sm:w-auto"
                  disabled={reply.isPending || !text.trim()}
                >
                  {reply.isPending ? t("portal.sending") : t("portal.sendReply")}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Attachments tab panel */}
        <div role="tabpanel" hidden={tab !== "attachments"} className={tab === "attachments" ? "space-y-3" : "hidden"}>
          <PortalAttachmentsTabContent
            attachments={attachments}
            isLoading={attachmentsLoading}
            isError={attachmentsError}
            onRetry={onRetryAttachments}
            locale={locale}
            canUpload={ticket.status !== "CLOSED"}
            onUpload={onAttachFile}
          />
        </div>
      </div>
    </section>
  );
}

export function PortalTicketDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = usePortalTicket(id);
  const reply = useReplyPortalTicket(id);
  const attachments = usePortalTicketAttachments(id);
  const uploadAttachment = useUploadPortalTicketAttachment(id);
  const [sendToken, setSendToken] = useState(0);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  if (query.isLoading) return (
    <PortalPage>
      <TicketDetailSkeleton variant="portal" label={t("portal.loadingDetail")} />
    </PortalPage>
  );
  if (query.isError) return (
    <PortalPage>
      <EmptyState
        className="mt-6"
        title={errorCode(query.error) === "TICKET_NOT_FOUND" ? t("portal.notFound") : t("portal.detailError")}
        action={<button type="button" className="button-secondary" onClick={() => query.refetch()}>{t("common.retry")}</button>}
      />
    </PortalPage>
  );
  const ticket = query.data!;
  const ticketLevelAttachments = attachments.data?.filter((item) => item.messageId === null) ?? [];
  const messageAttachments = new Map<string, NonNullable<typeof attachments.data>>();
  for (const item of attachments.data ?? []) if (item.messageId) messageAttachments.set(item.messageId, [...(messageAttachments.get(item.messageId) ?? []), item]);

  return (
    <PortalPage>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: Header, Conversation, Lower Workspace Tabs */}
        <div className="flex min-w-0 flex-col gap-4">
          <TicketDetailHeader
            backTo="/portal/tickets"
            backLabel={t("portal.back")}
            reference={ticket.id}
            subject={ticket.subject}
            badges={<PortalStatus status={ticket.status} />}
          />

          {/* Conversation card with controlled desktop height */}
          <div className="min-w-0 lg:h-[440px] lg:min-h-[360px] lg:max-h-[540px]">
            <ConversationSection
              bounded
              autoScrollItemCount={ticket.messages.length}
              autoScrollSendToken={sendToken}
              heading={t("portal.conversation")}
              countLabel={t("tickets.conversation.messageCount", { total: ticket.messages.length })}
              timelineLabel={t("portal.timelineLabel")}
              isEmpty={ticket.messages.length === 0}
              emptyTitle={t("portal.noMessages")}
            >
              {ticket.messages.map((message) => (
                <ConversationMessage
                  key={message.id}
                  side={message.author.kind === "CUSTOMER" ? "end" : "start"}
                  maxWidthClass="w-fit max-w-[85%] sm:max-w-[min(70%,560px)]"
                  title={t(`portal.author.${message.author.kind}`)}
                  timestamp={message.createdAt}
                  language={i18n.language}
                  body={message.body}
                  attachmentsSlot={<MessageAttachmentList attachments={messageAttachments.get(message.id) ?? []} scope="portal" />}
                />
              ))}
            </ConversationSection>
          </div>

          {/* Lower Workspace Tabs: Reply & Attachments */}
          <PortalWorkspaceTabs
            ticket={ticket}
            reply={reply}
            attachments={ticketLevelAttachments}
            attachmentsLoading={attachments.isLoading}
            attachmentsError={attachments.isError}
            onRetryAttachments={() => attachments.refetch()}
            locale={i18n.language}
            onSent={() => setSendToken((token) => token + 1)}
            onAttachFile={() => setUploadModalOpen(true)}
          />
        </div>

        {/* Right rail: Ticket details & Feedback (desktop right sticky sidebar, mobile below main workspace) */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <PortalTicketSidebar ticket={ticket} locale={i18n.language} />
          <TicketFeedback ticket={ticket} />
        </div>
      </div>

      <FileUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUpload={(file) => uploadAttachment.mutateAsync(file)}
        isUploading={uploadAttachment.isPending}
      />
    </PortalPage>
  );
}

