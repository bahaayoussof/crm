import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AppSelectField } from "@/components/ui/app-select";
import { WatchToggle } from "@/features/collaboration/watch-toggle";
import { getTicketError } from "./ticket-error";
import { formatTicketDate } from "./ticket-format";
import { useAgents, useCategories, useUpdateTicket } from "./ticket-hooks";
import type { SlaState, TicketDetail, TicketPriority, TicketStatus } from "./ticket.types";

const normalTransitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN"],
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["WAITING_CUSTOMER", "RESOLVED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: [],
  CLOSED: [],
  ESCALATED: [],
};

interface TicketSidebarProps {
  record: TicketDetail;
  canManage: boolean;
  canWorkflow: boolean;
  canClose: boolean;
  locale: string;
}

/** Contextual ticket information beside the conversation. One subtle container,
 * sections separated by dividers rather than a card per subsection. Attachments
 * live in the main conversation column, not here. */
export function TicketSidebar({ record, canManage, canWorkflow, canClose, locale }: TicketSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside className="min-w-0">
      <div className="divide-y divide-border-subtle rounded-xl border border-border bg-surface shadow-subtle">
        <PropertiesSection record={record} canManage={canManage} canWorkflow={canWorkflow} canClose={canClose} />
        <Section title={t("collaboration.followTicket")}>
          <WatchToggle
            ticketId={record.id}
            watching={record.viewerIsWatching ?? false}
            watcherCount={record.watcherCount ?? 0}
          />
        </Section>
        <CustomerSection record={record} />
        <DescriptionSection description={record.description} />
        <SlaSection record={record} language={locale} />
        <MetadataSection record={record} language={locale} />
        <ActivitySection history={record.history} language={locale} />
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function PropertiesSection({
  record,
  canManage,
  canWorkflow,
  canClose,
}: {
  record: TicketDetail;
  canManage: boolean;
  canWorkflow: boolean;
  canClose: boolean;
}) {
  const { t } = useTranslation();
  const update = useUpdateTicket(record.id);
  const categories = useCategories();
  const agents = useAgents();
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const confirmCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setStatus(record.status);
    setPriority(record.priority);
    setCategoryId(record.category?.id ?? "");
    setAssignedAgentId(record.assignedAgent?.id ?? "");
  }, [record]);
  useEffect(() => {
    if (confirmingClose) confirmCloseRef.current?.focus();
  }, [confirmingClose]);

  const availableStatuses = [
    ...normalTransitions[record.status],
    ...(canManage && ["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(record.status)
      ? ["ESCALATED" as TicketStatus]
      : []),
    ...(canManage && record.status === "ESCALATED" ? ["IN_PROGRESS" as TicketStatus] : []),
  ];
  const statusOptions = [
    { value: record.status, label: t(`tickets.status.${record.status}`) },
    ...availableStatuses
      .filter((value) => value !== record.status)
      .map((value) => ({ value, label: t(`tickets.status.${value}`) })),
  ];
  const priorityOptions = (["LOW", "MEDIUM", "HIGH", "URGENT"] as TicketPriority[]).map((value) => ({
    value,
    label: t(`tickets.priority.${value}`),
  }));
  const categoryOptions = [
    { value: "", label: t("common.notProvided") },
    ...(categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];
  const agentOptions = [
    { value: "", label: t("tickets.unassigned") },
    ...(agents.data?.map((item) => ({ value: item.id, label: item.name, searchText: item.email })) ?? []),
  ];

  const dirty =
    (status !== "" && status !== record.status) ||
    (priority !== "" && priority !== record.priority) ||
    (canManage && categoryId !== (record.category?.id ?? "")) ||
    (canManage && assignedAgentId !== (record.assignedAgent?.id ?? ""));

  const saveOperations = async () => {
    setError(null);
    const changes: {
      status?: TicketStatus;
      priority?: TicketPriority;
      categoryId?: string | null;
      assignedAgentId?: string | null;
    } = {};
    if (status && status !== record.status) changes.status = status;
    if (priority && priority !== record.priority) changes.priority = priority;
    if (canManage && categoryId !== (record.category?.id ?? "")) changes.categoryId = categoryId || null;
    if (canManage && assignedAgentId !== (record.assignedAgent?.id ?? ""))
      changes.assignedAgentId = assignedAgentId || null;
    if (!Object.keys(changes).length) return;
    try {
      await update.mutateAsync(changes);
    } catch (caught) {
      setError(getTicketError(caught, t("tickets.updateError"), t));
    }
  };
  const closeTicket = async () => {
    setError(null);
    try {
      await update.mutateAsync({ status: "CLOSED" });
      setConfirmingClose(false);
    } catch (caught) {
      setError(getTicketError(caught, t("tickets.closeError"), t));
    }
  };

  const labelClassName = "block text-sm font-medium text-foreground";
  return (
    <Section title={t("tickets.ticketDetails")}>
      {error && (
        <p
          className="break-words rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground [overflow-wrap:anywhere]"
          role="alert"
        >
          {error}
        </p>
      )}
      {!canWorkflow ? (
        <p className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">
          {t("tickets.unassignedReadOnly")}
        </p>
      ) : (
        <>
          <div className="grid gap-4">
            <AppSelectField
              id="ticket-detail-status"
              label={t("tickets.statusLabel")}
              labelClassName={labelClassName}
              value={status}
              disabled={availableStatuses.length === 0}
              onValueChange={(value) => setStatus(value as TicketStatus)}
              options={statusOptions}
            />
            <AppSelectField
              id="ticket-detail-priority"
              label={t("tickets.priorityLabel")}
              labelClassName={labelClassName}
              value={priority}
              onValueChange={(value) => setPriority(value as TicketPriority)}
              options={priorityOptions}
            />
            {canManage && (
              <AppSelectField
                id="ticket-detail-category"
                label={t("tickets.category")}
                labelClassName={labelClassName}
                value={categoryId}
                onValueChange={setCategoryId}
                options={categoryOptions}
              />
            )}
            {canManage && (
              <AppSelectField
                id="ticket-detail-agent"
                label={t("tickets.assignedAgent")}
                labelClassName={labelClassName}
                searchable
                searchPlaceholder={t("tickets.searchAssignee")}
                emptySearchMessage={t("tickets.noAssigneesFound")}
                value={assignedAgentId}
                onValueChange={setAssignedAgentId}
                options={agentOptions}
              />
            )}
          </div>
          {dirty && (
            <div className="flex">
              <button
                className="button-primary sm:ms-auto sm:w-auto"
                disabled={update.isPending}
                onClick={saveOperations}
              >
                {update.isPending ? t("common.saving") : t("tickets.saveOperations")}
              </button>
            </div>
          )}
        </>
      )}
      {canClose && (
        <div className="border-t border-border-subtle pt-3">
          {confirmingClose ? (
            <div
              className="rounded-lg border border-danger-subtle bg-danger-subtle/30 p-4"
              role="group"
              aria-label={t("tickets.closeConfirmation")}
            >
              <p className="text-sm font-medium text-danger-foreground">{t("tickets.closeConfirmation")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  ref={confirmCloseRef}
                  className="button-danger sm:w-auto"
                  disabled={update.isPending}
                  onClick={closeTicket}
                >
                  {update.isPending ? t("tickets.closing") : t("tickets.confirmClose")}
                </button>
                <button
                  className="button-secondary"
                  disabled={update.isPending}
                  onClick={() => setConfirmingClose(false)}
                >
                  {t("tickets.cancelClose")}
                </button>
              </div>
            </div>
          ) : (
            <button className="button-danger" onClick={() => setConfirmingClose(true)}>
              {t("tickets.closeTicket")}
            </button>
          )}
        </div>
      )}
    </Section>
  );
}

function CustomerSection({ record }: { record: TicketDetail }) {
  const { t } = useTranslation();
  return (
    <Section title={t("tickets.customer")}>
      <Link
        className="block break-words font-semibold text-primary hover:underline [overflow-wrap:anywhere]"
        to={`/customers/${record.customer.id}`}
      >
        {record.customer.name}
      </Link>
      <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
        <bdi dir="ltr">{record.customer.email}</bdi>
      </p>
      {record.customer.phone && (
        <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <bdi dir="ltr">{record.customer.phone}</bdi>
        </p>
      )}
      <Link
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        to={`/customers/${record.customer.id}`}
      >
        {t("tickets.viewCustomer")}
        <span aria-hidden="true" className="rtl:rotate-180">
          →
        </span>
      </Link>
    </Section>
  );
}

const DESC_LONG_CHARS = 400;
const DESC_LONG_LINES = 6;

function DescriptionSection({ description }: { description: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > DESC_LONG_CHARS || description.split("\n").length > DESC_LONG_LINES;
  return (
    <Section title={t("tickets.descriptionLabel")}>
      <p
        className={`whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere] ${
          isLong && !expanded ? "line-clamp-6" : ""
        }`}
      >
        {description}
      </p>
      {isLong && (
        <button
          type="button"
          className="rounded-sm text-xs font-medium text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("tickets.conversation.showLess") : t("tickets.conversation.showMore")}
        </button>
      )}
    </Section>
  );
}

function SlaSection({ record, language }: { record: TicketDetail; language: string }) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 p-4 sm:p-5" aria-labelledby="ticket-sla-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground" id="ticket-sla-heading">
          {t("tickets.sla.title")}
        </h2>
        <SlaStateLabel state={record.slaState} />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        {t(`tickets.sla.explanations.${record.slaState}`)}
      </p>
      <dl className="space-y-3 text-sm">
        {record.effectiveSlaTarget && (
          <Meta
            label={t("tickets.sla.activeTarget")}
            value={t(`tickets.sla.targets.${record.effectiveSlaTarget}`)}
          />
        )}
        {record.effectiveSlaDueAt && (
          <Meta
            label={t("tickets.sla.effectiveDue")}
            value={<DateValue value={record.effectiveSlaDueAt} language={language} />}
          />
        )}
        <Meta
          label={t("tickets.firstResponseDue")}
          value={
            record.firstResponseDueAt ? (
              <DateValue value={record.firstResponseDueAt} language={language} />
            ) : (
              t("common.notProvided")
            )
          }
        />
        <Meta
          label={t("tickets.sla.firstRespondedAt")}
          value={
            record.firstRespondedAt ? (
              <DateValue value={record.firstRespondedAt} language={language} />
            ) : (
              t("tickets.sla.awaitingFirstResponse")
            )
          }
        />
        <Meta
          label={t("tickets.resolutionDue")}
          value={
            record.resolutionDueAt ? (
              <DateValue value={record.resolutionDueAt} language={language} />
            ) : (
              t("common.notProvided")
            )
          }
        />
      </dl>
    </section>
  );
}

function MetadataSection({ record, language }: { record: TicketDetail; language: string }) {
  const { t } = useTranslation();
  return (
    <Section title={t("tickets.metadata")}>
      <dl className="space-y-3 text-sm">
        <Meta label={t("tickets.created")} value={<DateValue value={record.createdAt} language={language} />} />
        <Meta label={t("tickets.updated")} value={<DateValue value={record.updatedAt} language={language} />} />
      </dl>
    </Section>
  );
}

const ACTIVITY_PREVIEW_COUNT = 5;

function ActivitySection({
  history,
  language,
}: {
  history: TicketDetail["history"];
  language: string;
}) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hasMore = history.length > ACTIVITY_PREVIEW_COUNT;
  const visible = showAll ? history : history.slice(0, ACTIVITY_PREVIEW_COUNT);
  return (
    <Section title={t("tickets.activity")}>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tickets.noHistory")}</p>
      ) : (
        <>
          <ol
            className={`space-y-3 ${showAll && hasMore ? "max-h-[20rem] overflow-y-auto pe-1" : ""}`}
          >
            {visible.map((event) => (
              <li className="relative ps-4" key={event.id}>
                <span
                  className="absolute start-0 top-1.5 size-1.5 rounded-full bg-border-strong"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-3">
                  <p className="min-w-0 break-words text-sm font-medium text-foreground">
                    {t(`tickets.historyActions.${event.action}`, { defaultValue: event.action })}
                  </p>
                  <time
                    className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                    dir="ltr"
                    dateTime={event.createdAt}
                  >
                    {formatTicketDate(event.createdAt, language)}
                  </time>
                </div>
                <p className="mt-0.5 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {event.actor?.name ?? t("tickets.systemActor")}
                  {event.oldValue || event.newValue
                    ? `: ${event.oldValue ? displayValue(event.oldValue, t) : t("common.notProvided")} → ${
                        event.newValue ? displayValue(event.newValue, t) : t("common.notProvided")
                      }`
                    : ""}
                </p>
              </li>
            ))}
          </ol>
          {hasMore && (
            <button
              type="button"
              className="rounded-sm text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? t("tickets.conversation.showLess") : t("tickets.viewAllActivity")}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

function SlaStateLabel({ state }: { state: SlaState }) {
  const { t } = useTranslation();
  const styles: Record<SlaState, string> = {
    BREACHED: "border-danger-subtle bg-danger-subtle text-danger-foreground",
    AT_RISK: "border-warning-subtle bg-warning-subtle text-warning-foreground",
    ON_TRACK: "border-success-subtle bg-success-subtle text-success-foreground",
    MET: "border-success-subtle bg-success-subtle text-success-foreground",
    NOT_CONFIGURED: "border-border bg-surface-subtle text-muted-foreground",
  };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${styles[state]}`}>
      {t(`tickets.sla.states.${state}`)}
    </span>
  );
}

function DateValue({ value, language }: { value: string; language: string }) {
  return (
    <time dateTime={value}>
      <bdi dir="ltr">{formatTicketDate(value, language)}</bdi>
    </time>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] sm:gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground sm:text-end">{value}</dd>
    </div>
  );
}

function displayValue(value: string, t: TFunction) {
  if (["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"].includes(value))
    return t(`tickets.status.${value}`);
  if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(value)) return t(`tickets.priority.${value}`);
  return value;
}
