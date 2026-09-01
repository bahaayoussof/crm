import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowUpRight, Clock, Flame, Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableSurface } from "@/components/shared/data-table";
import { DataTableEmptyRow } from "@/components/shared/data-table/data-table-empty";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { TicketPriorityText, TicketStatusBadge } from "@/features/tickets/ticket-badges";
import { formatTicketDate, ticketReference } from "@/features/tickets/ticket-format";
import { useManagerOverview } from "./manager-hooks";
import { formatDurationMinutes, formatPercent } from "./manager-format";
import type { ManagerOverview, NeedsAttentionItem, TeamWorkloadRow } from "./manager.types";

const ATTENTION_META: Record<
  NeedsAttentionItem["key"],
  { tone: "danger" | "warning" | "primary"; icon: ReactNode }
> = {
  slaBreached: { tone: "danger", icon: <AlertTriangle className="size-4" /> },
  slaAtRisk: { tone: "warning", icon: <Clock className="size-4" /> },
  escalated: { tone: "danger", icon: <Flame className="size-4" /> },
  unassignedUrgent: { tone: "warning", icon: <Inbox className="size-4" /> },
};

type TabKey = "overview" | "operations";

export function ManagerOverviewPage() {
  const { t } = useTranslation();
  const query = useManagerOverview();
  const [tab, setTab] = useState<TabKey>("overview");

  if (query.isLoading) {
    return (
      <main className="page-container space-y-6" aria-label={t("common.loading")}>
        <OverviewSkeleton />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="page-container">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center shadow-subtle">
          <p className="text-sm text-muted-foreground">{t("manager.common.loadError")}</p>
          <Button variant="secondary" className="mt-4" onClick={() => query.refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      </main>
    );
  }

  const data = query.data;

  return (
    <main className="page-container space-y-6">
      <PageHeader title={t("manager.overview.title")} description={t("manager.overview.subtitle")} />

      <ManagerTabs active={tab} onChange={setTab} />

      {tab === "overview" ? (
        <div role="tabpanel" aria-label={t("manager.tabs.teamOverview")} className="space-y-8">
          <NeedsAttentionSection items={data.needsAttention} />
          <TeamWorkloadSection rows={data.teamWorkload} />
        </div>
      ) : (
        <div role="tabpanel" aria-label={t("manager.tabs.operations")} className="space-y-8">
          <KpiSection kpis={data.kpis} />
          <PriorityWorkSection tickets={data.priorityWork} />
        </div>
      )}
    </main>
  );
}

function ManagerTabs({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  const { t } = useTranslation();
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "overview", label: t("manager.tabs.teamOverview") },
    { key: "operations", label: t("manager.tabs.operations") },
  ];

  return (
    <div
      role="tablist"
      aria-label={t("manager.tabs.label")}
      aria-orientation="horizontal"
      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1 text-muted-foreground"
    >
      {tabs.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-card text-foreground shadow-subtle font-semibold"
                : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {action}
    </div>
  );
}

function NeedsAttentionSection({ items }: { items: NeedsAttentionItem[] }) {
  const { t } = useTranslation();
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="space-y-3">
      <SectionHeading title={t("manager.needsAttention.title")} />
      {total === 0 ? (
        <EmptyState title={t("manager.needsAttention.empty")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {items.map((item) => {
            const meta = ATTENTION_META[item.key];
            const muted = item.count === 0;
            return (
              <Link
                key={item.key}
                to={`/tickets?${item.ticketFilter}`}
                className={cn(
                  "group rounded-lg border p-4 shadow-subtle transition-colors",
                  muted
                    ? "border-border bg-card hover:bg-surface-hover"
                    : meta.tone === "danger"
                      ? "border-danger-soft bg-card hover:bg-danger-soft/30"
                      : "border-warning-soft bg-card hover:bg-warning-soft/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md",
                      muted
                        ? "bg-surface-secondary text-muted-foreground"
                        : meta.tone === "danger"
                          ? "bg-danger-soft text-danger-foreground"
                          : "bg-warning-soft text-warning-foreground",
                    )}
                  >
                    {meta.icon}
                  </span>
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums" dir="ltr">
                  {item.count}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                  {t(`manager.needsAttention.${item.key}`)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TeamWorkloadSection({ rows }: { rows: TeamWorkloadRow[] }) {
  const { t } = useTranslation();
  // ≤8 agents: show the whole team in one table. Larger team: a capacity split so
  // an overloaded agent AND an available one are both visible without paging to
  // `/manager/team` (which stays the complete roster). The two groups are always
  // stacked full-width rows — never side by side — for readability.
  const isSplit = rows.length > 8;

  const highest = isSplit ? rows.slice(0, 5) : rows;
  const capacity = isSplit
    ? [...rows]
        .sort((a, b) => a.openAssigned - b.openAssigned || a.agentName.localeCompare(b.agentName))
        .slice(0, 5)
    : [];

  return (
    <section className="space-y-3">
      <SectionHeading
        title={t("manager.workload.title")}
        action={
          <Link to="/manager/team" className="text-xs font-medium text-primary hover:underline">
            {t("manager.workload.viewFullTeam")} →
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={t("manager.workload.empty")} />
      ) : (
        <div className="space-y-6">
          <WorkloadTable caption={isSplit ? t("manager.workload.highestLoad") : undefined} rows={highest} />
          {isSplit && <WorkloadTable caption={t("manager.workload.hasCapacity")} rows={capacity} />}
        </div>
      )}
    </section>
  );
}

function WorkloadTable({ caption, rows }: { caption?: string; rows: TeamWorkloadRow[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {caption && <p className="text-xs font-medium text-muted-foreground">{caption}</p>}
      <DataTableSurface>
        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("manager.workload.agent")}</TableHead>
                <TableHead className="text-end">{t("manager.workload.open")}</TableHead>
                <TableHead className="text-end">{t("manager.workload.inProgress")}</TableHead>
                <TableHead className="text-end">{t("manager.workload.waiting")}</TableHead>
                <TableHead className="text-end">{t("manager.workload.atRisk")}</TableHead>
                <TableHead className="text-end">{t("manager.workload.resolvedToday")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.agentId}>
                  <TableCell>
                    <Link
                      to={`/manager/team/${row.agentId}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {row.agentName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-end font-semibold tabular-nums" dir="ltr">
                    {row.openAssigned}
                  </TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">
                    {row.inProgress}
                  </TableCell>
                  <TableCell className="text-end tabular-nums" dir="ltr">
                    {row.waitingCustomer}
                  </TableCell>
                  <TableCell
                    className={cn("text-end tabular-nums", row.atRisk > 0 && "font-semibold text-danger-foreground")}
                    dir="ltr"
                  >
                    {row.atRisk}
                  </TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground" dir="ltr">
                    {row.resolvedToday}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-table-border/60 sm:hidden">
          {rows.map((row) => (
            <li key={row.agentId} className="p-4">
              <Link
                to={`/manager/team/${row.agentId}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {row.agentName}
              </Link>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Stat label={t("manager.workload.open")} value={String(row.openAssigned)} />
                <Stat label={t("manager.workload.inProgress")} value={String(row.inProgress)} />
                <Stat label={t("manager.workload.waiting")} value={String(row.waitingCustomer)} />
                <Stat label={t("manager.workload.atRisk")} value={String(row.atRisk)} />
                <Stat label={t("manager.workload.resolvedToday")} value={String(row.resolvedToday)} />
              </dl>
            </li>
          ))}
        </ul>
      </DataTableSurface>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground tabular-nums" dir="ltr">
        {value}
      </dd>
    </div>
  );
}

function KpiSection({ kpis }: { kpis: ManagerOverview["kpis"] }) {
  const { t } = useTranslation();
  const cards: Array<{ key: string; value: string; to?: string }> = [
    { key: "openTickets", value: String(kpis.openTickets), to: "/tickets" },
    { key: "unassigned", value: String(kpis.unassigned), to: "/tickets?assignee=unassigned" },
    { key: "resolvedToday", value: String(kpis.resolvedToday) },
    { key: "slaCompliance", value: formatPercent(kpis.slaCompliancePct), to: "/reports/sla" },
    { key: "avgFirstResponse", value: formatDurationMinutes(kpis.avgFirstResponseMinutes), to: "/reports/sla" },
    { key: "avgResolution", value: formatDurationMinutes(kpis.avgResolutionMinutes), to: "/reports/sla" },
  ];

  return (
    <section className="space-y-3">
      <SectionHeading title={t("manager.kpis.title")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => {
          const body = <MetricCard label={t(`manager.kpis.${card.key}`)} value={card.value} />;
          return card.to ? (
            <Link key={card.key} to={card.to} className="block transition-transform hover:-translate-y-0.5">
              {body}
            </Link>
          ) : (
            <div key={card.key}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

function PriorityWorkSection({ tickets }: { tickets: ManagerOverview["priorityWork"] }) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-3">
      <SectionHeading title={t("manager.priorityWork.title")} />
      <DataTableSurface>
        {/* Desktop / tablet table */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("manager.priorityWork.colSubject")}</TableHead>
                <TableHead>{t("manager.priorityWork.colStatus")}</TableHead>
                <TableHead>{t("manager.priorityWork.colPriority")}</TableHead>
                <TableHead>{t("manager.priorityWork.colAssignee")}</TableHead>
                <TableHead className="text-end">{t("manager.priorityWork.colUpdated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <DataTableEmptyRow colSpan={5} message={t("manager.priorityWork.empty")} />
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="line-clamp-1 text-[12px] font-medium text-foreground hover:underline"
                        title={ticket.subject}
                      >
                        {ticket.subject}
                      </Link>
                      <span className="ms-2 text-[10px] text-muted-foreground" dir="ltr">
                        {ticketReference(ticket.id)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <TicketPriorityText priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      <AssigneeCell name={ticket.assignedAgent?.name} unassignedLabel={t("tickets.unassigned")} />
                    </TableCell>
                    <TableCell className="text-end whitespace-nowrap text-[11px] text-muted-foreground" dir="ltr">
                      {formatTicketDate(ticket.updatedAt, i18n.language)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-table-border/60 md:hidden">
          {tickets.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">{t("manager.priorityWork.empty")}</p>
          ) : (
            tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="block p-3.5 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[12px] font-medium text-foreground">{ticket.subject}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground" dir="ltr">
                      {ticketReference(ticket.id)}
                    </p>
                  </div>
                  <TicketPriorityText priority={ticket.priority} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  <span className="text-[11px] text-muted-foreground">
                    {ticket.assignedAgent?.name ?? t("tickets.unassigned")}
                  </span>
                </div>
                <p className="mt-2 border-t border-border-subtle pt-1.5 text-[10px] text-muted-foreground" dir="ltr">
                  {formatTicketDate(ticket.updatedAt, i18n.language)}
                </p>
              </Link>
            ))
          )}
        </div>
      </DataTableSurface>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-64 animate-pulse rounded bg-muted" />
      <div className="h-10 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
