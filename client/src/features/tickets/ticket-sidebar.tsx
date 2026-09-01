import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppSelectField } from "@/components/ui/app-select";
import { getTicketError } from "./ticket-error";
import { formatTicketDate } from "./ticket-format";
import { useAgents, useCategories, useUpdateTicket } from "./ticket-hooks";
import type { SlaState, TicketDetail, TicketPriority, TicketStatus } from "./ticket.types";

const normalTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["WAITING_CUSTOMER", "RESOLVED"],
  WAITING_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: [],
  ESCALATED: [],
};

interface TicketSidebarProps {
  record: TicketDetail;
  canManage: boolean;
  canWorkflow: boolean;
  canClose: boolean;
  canSelfAssign: boolean;
  currentUserId: string | null;
  locale: string;
}

/** The right context rail: exactly two cards — Ticket details and SLA. Customer,
 * Description, Activity, Followers, metadata and AI Assistant all live elsewhere
 * on the page now. */
export function TicketSidebar({ record, canManage, canWorkflow, canClose, canSelfAssign, currentUserId, locale }: TicketSidebarProps) {
  return (
    <aside className="min-w-0">
      <div className="space-y-3">
        <PropertiesSection
          record={record}
          canManage={canManage}
          canWorkflow={canWorkflow}
          canClose={canClose}
          canSelfAssign={canSelfAssign}
          currentUserId={currentUserId}
        />
        <SlaSection record={record} language={locale} />
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
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
  canSelfAssign,
  currentUserId,
}: {
  record: TicketDetail;
  canManage: boolean;
  canWorkflow: boolean;
  canClose: boolean;
  canSelfAssign: boolean;
  currentUserId: string | null;
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
    ...(canManage && ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"].includes(record.status)
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
      {canSelfAssign && currentUserId && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("tickets.claimHint")}</p>
          <button
            type="button"
            className="button-primary w-full sm:w-auto"
            disabled={update.isPending}
            onClick={async () => {
              setError(null);
              try {
                await update.mutateAsync({ assignedAgentId: currentUserId });
              } catch (caught) {
                setError(getTicketError(caught, t("tickets.claimError"), t));
              }
            }}
          >
            {update.isPending ? t("tickets.claiming") : t("tickets.assignToMe")}
          </button>
        </div>
      )}
      {canSelfAssign ? null : !canWorkflow ? (
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

function SlaSection({ record, language }: { record: TicketDetail; language: string }) {
  const { t } = useTranslation();
  return (
    <section
      className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5"
      aria-labelledby="ticket-sla-heading"
    >
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
