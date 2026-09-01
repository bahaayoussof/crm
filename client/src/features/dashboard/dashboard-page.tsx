import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "../auth/auth-state";
import { formatTicketDate, ticketReference } from "../tickets/ticket-format";
import {
  TicketPriorityText,
  TicketStatusBadge,
  SlaStatusDot,
} from "../tickets/ticket-badges";
import { useDashboardOverview } from "./dashboard-hooks";
import type { DashboardOverview, DashboardTicket } from "./dashboard.types";
import {
  DataTable,
  DataTableSurface,
  DataTableToolbar,
} from "@/components/shared/data-table";
import { AssigneeCell } from "@/components/shared/data-table/assignee-cell";
import { Skeleton, TableSkeleton } from "@/components/shared/skeleton";
import { ChartSkeleton } from "@/components/shared/charts";
import {
  DashboardMetricCard,
  type DashboardMetricTone,
} from "./components/dashboard-metric-card";
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
      <main
        className="page-container space-y-8"
        aria-label={t("common.loading")}
      >
        <DashboardSkeleton />
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="page-container">
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center shadow-subtle">
          <p className="text-sm text-muted-foreground">
            {t("dashboard.loadError")}
          </p>
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
  const legacyData = data as DashboardOverview & {
    needsAttention?: DashboardTicket[];
  };
  const primaryTickets =
    data.primaryTickets ?? (isAgent ? [] : (legacyData.needsAttention ?? []));
  const primaryIds = new Set(primaryTickets.map((ticket) => ticket.id));
  const recentTickets = (data.recentTickets ?? []).filter(
    (ticket) => !primaryIds.has(ticket.id),
  );
  const activity = data.ticketActivity ?? [];

  const metrics: Array<
    [key: string, value: number, tone: DashboardMetricTone]
  > = isAgent
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
        <PageHeader
          title={t("dashboard.title")}
          description={t("dashboard.agentDescription")}
        />

        <section
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          aria-label={t("dashboard.metricsLabel")}
        >
          {metrics.map(([key, value, tone]) => (
            <DashboardMetricCard
              key={key}
              label={t(`dashboard.metrics.${key}`)}
              value={value}
              tone={tone}
            />
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
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      {/* KPI snapshot */}
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        aria-label={t("dashboard.metricsLabel")}
      >
        {metrics.map(([key, value, tone]) => (
          <DashboardMetricCard
            key={key}
            label={t(`dashboard.metrics.${key}`)}
            value={value}
            tone={tone}
          />
        ))}
      </section>

      {/* Needs attention / My assigned tickets */}
      <TicketSection
        title={t(
          `dashboard.${isAgent ? "myAssignedTickets" : "needsAttention"}`,
        )}
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

  const columns = useMemo<ColumnDef<DashboardTicket>[]>(() => {
    const cols: ColumnDef<DashboardTicket>[] = [
      {
        id: "subject",
        header: t("tickets.subject"),
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              aria-label={`${t("tickets.columns.id")} ${row.original.id}`}
              className="line-clamp-1 break-words text-[12px] font-medium text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title={row.original.subject}
              to={`/tickets/${row.original.id}`}
              dir="ltr"
            >
              {row.original.subject}
            </Link>
          </div>
        ),
      },
      ...(detailed
        ? [
            {
              id: "customer",
              header: t("tickets.customer"),
              cell: ({ row }) => (
                <div className="min-w-0 leading-tight">
                  <p
                    className="truncate text-[12px] font-medium text-foreground"
                    title={row.original.customer.name}
                  >
                    {row.original.customer.name}
                  </p>
                </div>
              ),
            } as ColumnDef<DashboardTicket>,
          ]
        : []),
      {
        id: "status",
        header: t("tickets.statusLabel"),
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        id: "priority",
        header: t("tickets.priorityLabel"),
        cell: ({ row }) => (
          <TicketPriorityText priority={row.original.priority} />
        ),
      },
      ...(detailed
        ? [
            {
              id: "sla",
              header: t("dashboard.sla"),
              cell: ({ row }) => <SlaStatusDot state={row.original.slaState} />,
            } as ColumnDef<DashboardTicket>,
          ]
        : []),
      {
        id: "updated",
        header: t("tickets.updated"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {formatTicketDate(row.original.updatedAt, i18n.language)}
          </span>
        ),
      },
      {
        id: "agent",
        header: () => (
          <div className="text-center">{t("tickets.assignedAgent")}</div>
        ),
        cell: ({ row }) => (
          <AssigneeCell
            name={row.original.assignedAgent?.name}
            unassignedLabel={t("tickets.unassigned")}
          />
        ),
      },
    ];
    return cols;
  }, [detailed, i18n.language, t]);

  // Same width strategy as the canonical Tickets table: the subject column flexes
  // (`w-auto`) while the rest take intentional fixed widths, so the table fits the
  // card at desktop widths and only scrolls when genuinely too narrow.
  const columnWidths: Record<string, string> = detailed
    ? {
        subject: "w-auto",
        customer: "w-[140px]",
        status: "w-[155px]",
        priority: "w-[90px]",
        sla: "w-[120px]",
        updated: "w-[170px]",
        agent: "w-[150px]",
      }
    : {
        subject: "w-auto",
        status: "w-[155px]",
        priority: "w-[90px]",
        updated: "w-[170px]",
        agent: "w-[150px]",
      };

  return (
    <section className="space-y-3">
      {/* One canonical table module — the exact same shell the Tickets list
          renders: <DataTableSurface> > <DataTableToolbar> (bordered top strip) >
          <DataTable surface={false}> (header + body) > conditional footer. The
          section heading + count live INSIDE the toolbar strip, not floating above
          the card, so the block reads as a single unified table. Only the
          columns/data differ from Tickets. No pagination here — the shared shell's
          footer is conditional, identical to a single-page Tickets list. */}
      <DataTableSurface>
        <DataTableToolbar>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {tickets.length > 0 && (
              <Badge variant="secondary" size="sm">
                {tickets.length}
              </Badge>
            )}
          </div>
          {action}
        </DataTableToolbar>
        <DataTable
          surface={false}
          data={tickets}
          columns={columns}
          getRowId={(ticket) => ticket.id}
          columnWidths={columnWidths}
          emptyMessage={empty}
          renderMobileCard={
            tickets.length
              ? (ticket) => (
                  <Link
                    className="block p-3.5 transition-colors hover:bg-table-row-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
                    to={`/tickets/${ticket.id}`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <p
                          className="line-clamp-1 font-medium text-[12px] text-foreground"
                          title={ticket.subject}
                        >
                          {ticket.subject}
                        </p>
                        <p
                          className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                          title={ticket.id}
                        >
                          <bdi dir="ltr">{ticketReference(ticket.id)}</bdi>
                        </p>
                      </div>
                      <TicketPriorityText priority={ticket.priority} />
                    </div>
                    {detailed && (
                      <p
                        className="mt-1 truncate text-[10px] text-muted-foreground"
                        title={ticket.customer.name}
                      >
                        {ticket.customer.name}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <TicketStatusBadge status={ticket.status} />
                      {detailed ? (
                        <SlaStatusDot state={ticket.slaState} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          {ticket.customer.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 border-t border-border-subtle pt-1.5 text-[10px] text-muted-foreground">
                      {ticket.assignedAgent?.name ?? t("tickets.unassigned")}{" "}
                      <span aria-hidden="true">·</span>{" "}
                      <span dir="ltr">
                        {formatTicketDate(ticket.updatedAt, i18n.language)}
                      </span>
                    </p>
                  </Link>
                )
              : undefined
          }
        />
      </DataTableSurface>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton className="h-20 rounded-lg" key={i} />
        ))}
      </div>
      <TableSkeleton columns={7} rows={5} />
      <div className="grid gap-6 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" height={340} />
        <ChartSkeleton height={340} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
      <TableSkeleton columns={6} rows={5} />
    </div>
  );
}
