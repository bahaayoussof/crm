import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const query = useDashboardOverview();

  if (query.isLoading) {
    return (
      <main className="page-container space-y-6" aria-label={t("common.loading")}>
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

  const metrics = isAgent
    ? ([
        ["assignedToMe", data.metrics.assignedToMe, "primary"],
        ["slaBreached", data.metrics.slaBreached, "danger"],
        ["slaAtRisk", data.metrics.slaAtRisk, "warning"],
        ["waitingCustomer", data.metrics.waitingCustomer, "default"],
        ["resolvedToday", data.metrics.resolvedToday, "success"],
      ] as const)
    : ([
        ["openTickets", data.metrics.openTickets, "primary"],
        ["unassignedTickets", data.metrics.unassignedTickets, "default"],
        ["slaBreached", data.metrics.slaBreached, "danger"],
        ["slaAtRisk", data.metrics.slaAtRisk, "warning"],
        ["resolvedToday", data.metrics.resolvedToday, "success"],
      ] as const);

  return (
    <main className="page-container space-y-7">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
      />

      {/* Metric Cards Row */}
      <section
        className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5"
        aria-label={t("dashboard.metricsLabel")}
      >
        {metrics.map(([key, value, variant]) => (
          <div
            key={key}
            className={cn(
              "flex flex-col justify-between rounded-xl border bg-card p-4 shadow-subtle transition-all",
              variant === "danger" && value > 0 && "border-danger-soft bg-danger-soft/20",
              variant === "warning" && value > 0 && "border-warning-soft bg-warning-soft/20",
              variant === "primary" && "border-border",
              variant === "default" && "border-border",
              variant === "success" && "border-border"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium text-muted-foreground">
                {t(`dashboard.metrics.${key}`)}
              </p>
              {variant === "danger" && value > 0 && (
                <span className="flex size-2 rounded-full bg-danger animate-pulse" />
              )}
              {variant === "warning" && value > 0 && (
                <span className="flex size-2 rounded-full bg-warning" />
              )}
            </div>
            <p
              className={cn(
                "mt-2 text-2xl font-bold tracking-tight tabular-nums",
                variant === "danger" && value > 0 ? "text-danger-foreground font-semibold" : "text-card-foreground"
              )}
              dir="ltr"
            >
              {new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US").format(value)}
            </p>
          </div>
        ))}
      </section>

      {/* Primary Workload Section (Needs Attention / My Assigned Tickets) */}
      <TicketSection
        title={t(`dashboard.${isAgent ? "myAssignedTickets" : "needsAttention"}`)}
        empty={t(`dashboard.${isAgent ? "emptyAssigned" : "emptyAttention"}`)}
        tickets={primaryTickets}
        detailed
        highlight
      />

      {/* Operational Charts & Summary Grid */}
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Distribution data={data} />
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.summaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border-subtle">
              <Summary label={t("dashboard.metrics.waitingCustomer")} value={data.metrics.waitingCustomer} />
              <Summary
                label={t(`dashboard.metrics.${isAgent ? "assignedToMe" : "unassignedTickets"}`)}
                value={isAgent ? data.metrics.assignedToMe : data.metrics.unassignedTickets}
              />
              <Summary
                label={t("dashboard.generatedAt")}
                value={formatTicketDate(data.generatedAt, i18n.language)}
                technical
              />
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* Recent Tickets Section */}
      <TicketSection
        title={t("dashboard.recentTickets")}
        empty={t("dashboard.emptyRecent")}
        tickets={recentTickets}
      />

      <div>
        <Link className="text-sm font-medium text-foreground hover:underline" to="/tickets">
          {t("dashboard.viewAll")}
        </Link>
      </div>
    </main>
  );
}

function Distribution({ data }: { data: DashboardOverview }) {
  const { t } = useTranslation();
  const chart = data.statusDistribution.map((item) => ({
    ...item,
    label: t(`tickets.status.${item.status}`),
  }));

  return (
    <Card aria-labelledby="dashboard-chart-title" aria-describedby="dashboard-chart-description">
      <CardHeader>
        <CardTitle id="dashboard-chart-title">{t("dashboard.chartTitle")}</CardTitle>
        <CardDescription id="dashboard-chart-description">{t("dashboard.chartDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {chart.length ? (
          <>
            <div className="h-60" data-testid="status-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: "0.5rem",
                      boxShadow: "var(--shadow-flyout)",
                      fontSize: "0.75rem",
                      color: "var(--popover-foreground)",
                    }}
                    formatter={(value) => [value, t("dashboard.ticketsCount")]}
                  />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="sr-only">
              {chart.map((item) => (
                <li key={item.status}>
                  {item.label}: {item.count}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">{t("dashboard.emptyDistribution")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TicketSection({
  title,
  empty,
  tickets,
  detailed = false,
  highlight = false,
}: {
  title: string;
  empty: string;
  tickets: DashboardTicket[];
  detailed?: boolean;
  highlight?: boolean;
}) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {tickets.length > 0 && (
          <Badge variant="secondary" size="sm">
            {tickets.length}
          </Badge>
        )}
      </div>

      {tickets.length ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <TableContainer>
              <Table className={detailed ? "min-w-[76rem]" : "min-w-[58rem]"}>
                <colgroup>
                  <col className="w-28" />
                  <col className={detailed ? "w-72" : "w-80"} />
                  {detailed && <col className="w-48" />}
                  <col className="w-28" />
                  <col className="w-40" />
                  {detailed && <col className="w-36" />}
                  <col className="w-48" />
                  <col className="w-44" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    {[
                      t("tickets.columns.id"),
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
                          className="font-mono text-xs font-medium text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          title={ticket.id}
                          to={`/tickets/${ticket.id}`}
                          dir="ltr"
                        >
                          {ticketReference(ticket.id)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-2 min-w-0 break-words font-medium text-foreground" title={ticket.subject}>
                          {ticket.subject}
                        </span>
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

function Summary({ label, value, technical }: { label: string; value: string | number; technical?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-end text-xs font-semibold tabular-nums text-foreground" dir={technical ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div className="h-24 animate-pulse rounded-xl bg-muted" key={i} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-72 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
