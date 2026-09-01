import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "../auth/auth-state";
import { formatTicketDate, ticketReference } from "../tickets/ticket-format";
import { TicketPriorityText, TicketStatusBadge } from "../tickets/ticket-badges";
import { useDashboardOverview } from "./dashboard-hooks";
import type { DashboardOverview, DashboardTicket } from "./dashboard.types";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { ChartSkeleton } from "@/components/shared/charts";
import { DashboardSectionHeader } from "./components/dashboard-section-header";
import { DashboardMetricCard, type DashboardMetricTone } from "./components/dashboard-metric-card";
import { TicketStatusDonut } from "./components/ticket-status-donut";
import { TicketActivityChart } from "./components/ticket-activity-chart";
import { SlaHealthCard } from "./components/sla-health-card";
import { OperationalSummary } from "./components/operational-summary";
import { AgentPerformanceCard } from "./components/agent-performance-card";

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const query = useDashboardOverview();

  if (query.isLoading) {
    return (
      <main className="page-container space-y-8" aria-label={t("common.loading")}>
        <DashboardSkeleton />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="page-container">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center shadow-subtle">
          <p className="text-sm text-muted-foreground">{t("dashboard.loadError")}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => query.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const data = query.data;
  const isAgent = user?.role === "AGENT";
  const legacyData = data as DashboardOverview & { needsAttention?: DashboardTicket[] };
  const primaryTickets = data.primaryTickets ?? (isAgent ? [] : legacyData.needsAttention ?? []);
  const primaryIds = new Set(primaryTickets.map((ticket) => ticket.id));
  const recentTickets = (data.recentTickets ?? []).filter((ticket) => !primaryIds.has(ticket.id));
  const activity = data.ticketActivity ?? [];

  const metrics: Array<[key: string, value: number, tone: DashboardMetricTone]> = isAgent
    ? [
        ["openTickets", data.metrics.openTickets, "primary"],
        ["overdueTickets", data.metrics.slaBreached, "danger"],
        ["slaAtRisk", data.metrics.slaAtRisk, "warning"],
        ["waitingCustomer", data.metrics.waitingCustomer, "neutral"],
        ["resolvedToday", data.metrics.resolvedToday, "success"],
      ]
    : [
        ["openTickets", data.metrics.openTickets, "primary"],
        ["unassignedTickets", data.metrics.unassignedTickets, "neutral"],
        ["slaAtRisk", data.metrics.slaAtRisk, "warning"],
        ["slaBreached", data.metrics.slaBreached, "danger"],
        ["resolvedToday", data.metrics.resolvedToday, "success"],
      ];

  // AGENT: a lean personal work console — no organization-wide analytics.
  // "What needs attention now → at risk/overdue → my workload → recent activity
  //  → small personal performance summary." No activity chart, no status donut.
  if (isAgent) {
    return (
      <main className="page-container space-y-8">
        <PageHeader title={t("dashboard.title")} description={t("dashboard.agentDescription")} />

        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          aria-label={t("dashboard.metricsLabel")}
        >
          {metrics.map(([key, value, tone]) => (
            <DashboardMetricCard key={key} label={t(`dashboard.metrics.${key}`)} value={value} tone={tone} />
          ))}
        </section>

        <TicketSection
          title={t("dashboard.priorityWorkQueue")}
          empty={t("dashboard.emptyAssigned")}
          tickets={primaryTickets}
          detailed
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <SlaHealthCard data={data} />
          <AgentPerformanceCard performance={data.agentPerformance} />
        </section>

        <TicketSection
          title={t("dashboard.recentTickets")}
          empty={t("dashboard.emptyRecent")}
          tickets={recentTickets}
          action={
            <Link
              className="text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              to="/tickets"
            >
              {t("dashboard.viewAll")}
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="page-container space-y-8">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.description")} />

      {/* KPI snapshot */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label={t("dashboard.metricsLabel")}
      >
        {metrics.map(([key, value, tone]) => (
          <DashboardMetricCard key={key} label={t(`dashboard.metrics.${key}`)} value={value} tone={tone} />
        ))}
      </section>

      {/* Needs attention / My assigned tickets */}
      <TicketSection
        title={t(`dashboard.${isAgent ? "myAssignedTickets" : "needsAttention"}`)}
        empty={t(`dashboard.${isAgent ? "emptyAssigned" : "emptyAttention"}`)}
        tickets={primaryTickets}
        detailed
      />

      {/* Ticket activity (primary) + status distribution */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TicketActivityChart points={activity} />
        </div>
        <TicketStatusDonut data={data} />
      </section>

      {/* SLA health + operational summary */}
      <section className="grid gap-6 lg:grid-cols-2">
        <SlaHealthCard data={data} />
        <OperationalSummary data={data} isAgent={!!isAgent} />
      </section>

      {/* Recent tickets */}
      <TicketSection
        title={t("dashboard.recentTickets")}
        empty={t("dashboard.emptyRecent")}
        tickets={recentTickets}
        action={
          <Link
            className="text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            to="/tickets"
          >
            {t("dashboard.viewAll")}
          </Link>
        }
      />
    </main>
  );
}

function TicketSection({
  title,
  empty,
  tickets,
  detailed = false,
  action,
}: {
  title: string;
  empty: string;
  tickets: DashboardTicket[];
  detailed?: boolean;
  action?: ReactNode;
}) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-3">
      <DashboardSectionHeader title={title} count={tickets.length} action={action} />

      {tickets.length ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table className={detailed ? "min-w-[68rem]" : "min-w-[54rem]"}>
                <colgroup>
                  <col className={detailed ? "w-64" : "w-72"} />
                  {detailed && <col className="w-40" />}
                  <col className="w-28" />
                  <col className="w-40" />
                  {detailed && <col className="w-36" />}
                  <col className="w-44" />
                  <col className="w-40" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    {[
                      t("tickets.subject"),
                      ...(detailed ? [t("tickets.customer")] : []),
                      t("tickets.priorityLabel"),
                      t("tickets.statusLabel"),
                      ...(detailed ? [t("dashboard.sla")] : []),
                      t("tickets.assignedAgent"),
                      t("tickets.updated"),
                    ].map((label) => (
                      <TableHead className="whitespace-nowrap" key={label}>
                        {label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <Link
                          aria-label={`${t("tickets.columns.id")} ${ticket.id}`}
                          className="line-clamp-2 min-w-0 break-words font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={ticket.subject}
                          to={`/tickets/${ticket.id}`}
                          dir="ltr"
                        >
                          {ticket.subject}
                        </Link>
                      </TableCell>
                      {detailed && (
                        <TableCell>
                          <span className="line-clamp-2 min-w-0 break-words text-muted-foreground" title={ticket.customer.name}>
                            {ticket.customer.name}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap">
                        <TicketPriorityText priority={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <TicketStatusBadge status={ticket.status} />
                      </TableCell>
                      {detailed && (
                        <TableCell className="whitespace-nowrap">
                          <Sla state={ticket.slaState} />
                        </TableCell>
                      )}
                      <TableCell>
                        <AssigneeCell
                          name={ticket.assignedAgent?.name}
                          unassignedLabel={t("tickets.unassigned")}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        <bdi dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</bdi>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile Cards */}
          <div className="grid gap-3 md:hidden">
            {tickets.map((ticket) => (
              <Link
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-subtle transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                to={`/tickets/${ticket.id}`}
                key={ticket.id}
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-xs font-medium text-muted-foreground" title={ticket.id} dir="ltr">
                    {ticketReference(ticket.id)}
                  </span>
                  <TicketPriorityText priority={ticket.priority} />
                </div>
                <p className="mt-2 line-clamp-2 break-words font-semibold text-foreground" title={ticket.subject}>
                  {ticket.subject}
                </p>
                {detailed && (
                  <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground" title={ticket.customer.name}>
                    {ticket.customer.name}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TicketStatusBadge status={ticket.status} />
                  {detailed && <Sla state={ticket.slaState} />}
                </div>
                <p className="mt-3 border-t border-border-subtle pt-2 min-w-0 truncate text-xs text-muted-foreground" title={ticket.assignedAgent?.name ?? t("tickets.unassigned")}>
                  {ticket.assignedAgent?.name ?? t("tickets.unassigned")} <span aria-hidden="true">·</span>{" "}
                  <span dir="ltr">{formatTicketDate(ticket.updatedAt, i18n.language)}</span>
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </section>
  );
}

function Sla({ state }: { state: DashboardTicket["slaState"] }) {
  const { t } = useTranslation();
  if (!state) return null;
  const variant = state === "BREACHED" ? "danger" : state === "AT_RISK" ? "warning" : "neutral";
  return (
    <Badge variant={variant} size="sm">
      {t(`dashboard.slaStates.${state}`)}
    </Badge>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="h-20 animate-pulse rounded-lg bg-muted" key={i} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" height={340} />
        <ChartSkeleton height={340} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
