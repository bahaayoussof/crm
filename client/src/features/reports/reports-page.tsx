import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { TicketPriorityText } from "../tickets/ticket-badges";
import { useAgentReports, useReportsOverview, useSlaReports, useTicketReports } from "./reports-hooks";
import type { AgentReportRow, ReportsRangeParams } from "./reports.types";
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartEmptyState,
  ChartSkeleton,
  CANONICAL_STATUS_ORDER,
  getStatusChartColor,
  CHART_THEME_TOKENS,
} from "@/components/shared/charts";
import { cn } from "@/lib/utils";
import { DateRangePicker, type DateRange } from "@/components/date-picker/date-range-picker";

const PRESETS = [7, 30, 90] as const;

/** Local calendar day → the same day at 00:00:00 UTC (matches the old date-input serialization). */
function toUtcMidnightIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const range = useMemo<ReportsRangeParams>(() => {
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;
    return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  }, [params]);

  const overview = useReportsOverview(range);
  const sla = useSlaReports(range);
  const agents = useAgentReports(range);
  const tickets = useTicketReports(range);
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"), [i18n.language]);

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    setParams({ from: from.toISOString(), to: to.toISOString() });
  };
  const activePreset = useMemo(() => {
    if (!range.from || !range.to) return 30;
    const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000);
    return PRESETS.includes(days as (typeof PRESETS)[number]) ? days : null;
  }, [range]);

  const rangeValue = useMemo<DateRange>(
    () => ({
      from: range.from ? new Date(range.from) : undefined,
      to: range.to ? new Date(range.to) : undefined,
    }),
    [range],
  );

  const setRange = (next: DateRange) => {
    const params2 = new URLSearchParams(params);
    // Preserve the previous date-only → UTC-midnight serialization.
    if (next.from) params2.set("from", toUtcMidnightIso(next.from));
    else params2.delete("from");
    if (next.to) params2.set("to", toUtcMidnightIso(next.to));
    else params2.delete("to");
    setParams(params2);
  };

  if (overview.isLoading) {
    return (
      <main className="page-container space-y-6" aria-label={t("common.loading")}>
        <Skeleton />
      </main>
    );
  }
  if (overview.isError || !overview.data) {
    return (
      <main className="page-container">
        <InlineState text={t("reports.loadError")}>
          <button className="button-secondary" onClick={() => overview.refetch()}>
            {t("common.retry")}
          </button>
        </InlineState>
      </main>
    );
  }

  const data = overview.data;
  const k = data.kpis;
  const volume = data.ticketVolume.map((point) => ({ ...point, label: point.date.slice(5) }));

  const statusMap = new Map(data.statusDistribution.map((row) => [row.status, row.count]));
  const statusChart = CANONICAL_STATUS_ORDER
    .filter((status) => statusMap.has(status))
    .map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
      label: t(`tickets.status.${status}`),
      color: getStatusChartColor(status),
    }));

  return (
    <main className="page-container space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      />

      <section className="rounded-xl border border-border bg-surface p-4 shadow-subtle" aria-label={t("reports.filters.label")}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("reports.filters.presetLabel")}>
            {PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={activePreset === days}
                className={cn(
                  "min-h-8 rounded-md px-3 text-xs font-medium transition-colors select-none",
                  activePreset === days
                    ? "bg-surface-active text-foreground font-semibold border border-border-strong shadow-2xs"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground border border-border"
                )}
                onClick={() => applyPreset(days)}
              >
                {t("reports.filters.lastDays", { count: days })}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span>{t("reports.filters.from")} – {t("reports.filters.to")}</span>
            <DateRangePicker
              ariaLabel={`${t("reports.filters.from")} – ${t("reports.filters.to")}`}
              value={rangeValue}
              onChange={setRange}
              maxDate={new Date()}
              className="w-64"
              triggerClassName="h-9 min-h-9 text-xs"
            />
          </div>
          {(range.from || range.to) && <button type="button" className="button-ghost px-2 text-xs" onClick={() => setParams({})}>{t("reports.filters.reset")}</button>}
        </div>
        <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
          {range.from ? range.from.slice(0, 10) : "—"} → {range.to ? range.to.slice(0, 10) : "—"}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={t("reports.kpisLabel")}>
        <Kpi label={t("reports.kpis.createdTickets")} value={nf.format(k.createdTickets)} />
        <Kpi label={t("reports.kpis.resolvedTickets")} value={nf.format(k.resolvedTickets)} />
        <Kpi label={t("reports.kpis.slaCompliance")} value={k.slaCompliancePct === null ? "—" : `${nf.format(k.slaCompliancePct)}%`} />
        <Kpi label={t("reports.kpis.averageResponse")} value={formatMinutes(k.averageFirstResponseMinutes, t)} />
        <Kpi label={t("reports.kpis.satisfaction")} value={k.satisfaction.averageRating === null ? "—" : `${nf.format(k.satisfaction.averageRating)} / 5`} sub={t("reports.kpis.satisfactionResponses", { count: k.satisfaction.responseCount })} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("reports.volumeTitle")}>
          {volume.length ? (
            <div className="mt-4 h-56" data-testid="volume-chart">
              <ChartContainer label={t("reports.volumeTitle")}>
                <BarChart data={volume} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME_TOKENS.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: CHART_THEME_TOKENS.axis }}
                    interval="preserveStartEnd"
                    stroke={CHART_THEME_TOKENS.axis}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART_THEME_TOKENS.axis }}
                    width={32}
                    stroke={CHART_THEME_TOKENS.axis}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend content={<ChartLegendContent />} />
                  <Bar
                    name={t("reports.legend.created")}
                    dataKey="created"
                    fill="var(--chart-1)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    name={t("reports.legend.resolved")}
                    dataKey="resolved"
                    fill="var(--chart-2)"
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <ChartEmptyState description={t("reports.emptyVolume")} className="mt-4" />
          )}
        </Panel>

        <Panel title={t("reports.statusTitle")}>
          {statusChart.length ? (
            <>
              <div className="mt-4 h-56" data-testid="status-chart">
                <ChartContainer label={t("reports.statusTitle")}>
                  <BarChart data={statusChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_THEME_TOKENS.grid} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: CHART_THEME_TOKENS.axis }}
                      stroke={CHART_THEME_TOKENS.axis}
                    />
                    <YAxis
                      dataKey="label"
                      type="category"
                      width={104}
                      tick={{ fontSize: 10, fill: "var(--foreground)" }}
                      stroke={CHART_THEME_TOKENS.axis}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                      {statusChart.map((entry) => (
                        <Cell key={entry.status} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
              <ul className="sr-only">
                {statusChart.map((row) => (
                  <li key={row.status}>
                    {row.label}: {row.count}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ChartEmptyState description={t("reports.emptyStatus")} className="mt-4" />
          )}
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("reports.slaTitle")} description={t("reports.slaDescription")}>
          {sla.isError || !sla.data ? (
            <SectionError onRetry={() => sla.refetch()} loading={sla.isLoading} />
          ) : (
            <div className="mt-4 space-y-4">
              <SlaBar label={t("reports.sla.firstResponse")} tally={sla.data.firstResponse} nf={nf} t={t} />
              <SlaBar label={t("reports.sla.resolution")} tally={sla.data.resolution} nf={nf} t={t} />
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("reports.sla.avgFirstResponse")}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatMinutes(sla.data.averageFirstResponseMinutes, t)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("reports.sla.avgResolution")}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{formatMinutes(sla.data.averageResolutionMinutes, t)}</dd>
                </div>
              </dl>
              <TableContainer>
                <Table className="min-w-[28rem]">
                  <TableHeader>
                    <TableRow>
                      {[
                        t("tickets.priorityLabel"),
                        t("reports.sla.metShort"),
                        t("reports.sla.breachedShort"),
                        t("reports.sla.complianceShort"),
                      ].map((label) => (
                        <TableHead key={label}>{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sla.data.byPriority.map((row) => (
                      <TableRow key={row.priority}>
                        <TableCell>
                          <TicketPriorityText priority={row.priority} />
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {nf.format(row.firstResponseMet)}
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">
                          {nf.format(row.firstResponseBreached)}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium text-foreground">
                          {row.compliancePct === null ? "—" : `${nf.format(row.compliancePct)}%`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
          )}
        </Panel>

        <Panel title={t("reports.satisfactionTitle")} description={t("reports.satisfactionDescription")}>
          {data.satisfaction.responseCount === 0 ? (
            <ChartEmptyState description={t("reports.emptySatisfaction")} className="mt-4" />
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">{t("reports.satisfactionSummary", { rating: data.satisfaction.averageRating, count: data.satisfaction.responseCount })}</p>
              {[...data.satisfaction.distribution].reverse().map((row) => {
                const pct = data.satisfaction.responseCount ? Math.round((row.count / data.satisfaction.responseCount) * 100) : 0;
                return (
                  <div key={row.rating} className="flex items-center gap-3 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground font-medium">{nf.format(row.rating)} ★</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-subtle border border-border">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-end tabular-nums font-semibold text-foreground">{nf.format(row.count)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </section>

      <Panel title={t("reports.agentsTitle")} description={t("reports.agentsDescription")}>
        {agents.isError || !agents.data ? (
          <SectionError onRetry={() => agents.refetch()} loading={agents.isLoading} />
        ) : agents.data.agents.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("reports.emptyAgents")}</p>
        ) : (
          <AgentTable rows={agents.data.agents} nf={nf} />
        )}
      </Panel>

      <Panel title={t("reports.breakdownTitle")}>
        {tickets.isError || !tickets.data ? (
          <SectionError onRetry={() => tickets.refetch()} loading={tickets.isLoading} />
        ) : (
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("reports.byPriority")}</h3>
              <TableContainer className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[t("tickets.priorityLabel"), t("reports.legend.created"), t("reports.legend.resolved")].map((label) => (
                        <TableHead key={label}>{label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.data.byPriority.map((row) => (
                      <TableRow key={row.priority}>
                        <TableCell>
                          <TicketPriorityText priority={row.priority} />
                        </TableCell>
                        <TableCell className="tabular-nums text-foreground">{nf.format(row.created)}</TableCell>
                        <TableCell className="tabular-nums text-foreground">{nf.format(row.resolved)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("reports.byCategory")}</h3>
              {tickets.data.byCategory.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t("reports.emptyStatus")}</p>
              ) : (
                <TableContainer className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {[t("tickets.category"), t("reports.legend.created")].map((label) => (
                          <TableHead key={label}>{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.data.byCategory.map((row) => (
                        <TableRow key={row.categoryId ?? "uncategorized"}>
                          <TableCell>
                            <span className="line-clamp-1 break-words font-medium text-foreground" title={row.categoryName ?? t("reports.uncategorized")}>
                              {row.categoryName ?? t("reports.uncategorized")}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums text-foreground">{nf.format(row.created)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </div>
          </div>
        )}
      </Panel>
    </main>
  );
}

function AgentTable({ rows, nf }: { rows: AgentReportRow[]; nf: Intl.NumberFormat }) {
  const { t } = useTranslation();
  const headers = [
    t("reports.agents.name"),
    t("reports.agents.assigned"),
    t("reports.agents.resolved"),
    t("reports.agents.open"),
    t("reports.agents.slaMet"),
    t("reports.agents.avgResponse"),
  ];
  return (
    <>
      <div className="mt-3 hidden md:block">
        <TableContainer>
          <Table className="min-w-[52rem]">
            <colgroup>
              <col className="w-56" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-28" />
              <col className="w-32" />
            </colgroup>
            <TableHeader>
              <TableRow>
                {headers.map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.agentId}>
                  <TableCell>
                    <span className="line-clamp-1 break-words font-semibold text-foreground" title={row.agentName}>
                      {row.agentName}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-foreground">{nf.format(row.assigned)}</TableCell>
                  <TableCell className="tabular-nums text-foreground">{nf.format(row.resolved)}</TableCell>
                  <TableCell className="tabular-nums text-foreground">{nf.format(row.open)}</TableCell>
                  <TableCell className="tabular-nums font-medium text-foreground">
                    {row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatMinutes(row.averageFirstResponseMinutes, t)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
      <ul className="mt-3 grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.agentId} className="rounded-xl border border-border bg-surface p-4 shadow-subtle">
            <p className="font-semibold text-foreground" dir="auto">{row.agentName}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground text-xs">{t("reports.agents.assigned")}</dt><dd className="tabular-nums font-medium">{nf.format(row.assigned)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground text-xs">{t("reports.agents.resolved")}</dt><dd className="tabular-nums font-medium">{nf.format(row.resolved)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground text-xs">{t("reports.agents.open")}</dt><dd className="tabular-nums font-medium">{nf.format(row.open)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground text-xs">{t("reports.agents.slaMet")}</dt><dd className="tabular-nums font-medium">{row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function SlaBar({ label, tally, nf, t }: { label: string; tally: { met: number; breached: number; pending: number; total: number; compliancePct: number | null }; nf: Intl.NumberFormat; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const total = tally.total || 1;
  const segments = [
    { key: "met", value: tally.met, color: "bg-success" },
    { key: "breached", value: tally.breached, color: "bg-danger" },
    { key: "pending", value: tally.pending, color: "bg-warning" },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums font-semibold text-foreground">{tally.compliancePct === null ? "—" : `${nf.format(tally.compliancePct)}%`}</span>
      </div>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-surface-subtle border border-border" role="img" aria-label={`${label}: ${t("reports.sla.metShort")} ${tally.met}, ${t("reports.sla.breachedShort")} ${tally.breached}, ${t("reports.sla.pendingShort")} ${tally.pending}`}>
        {segments.map((segment) => segment.value > 0 && <span key={segment.key} className={segment.color} style={{ width: `${(segment.value / total) * 100}%` }} />)}
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {t("reports.sla.metShort")} {nf.format(tally.met)} · {t("reports.sla.breachedShort")} {nf.format(tally.breached)} · {t("reports.sla.pendingShort")} {nf.format(tally.pending)}
      </p>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-subtle">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums" dir="ltr">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

function SectionError({ onRetry, loading }: { onRetry: () => void; loading?: boolean }) {
  const { t } = useTranslation();
  if (loading) return <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>;
  return (
    <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
      <span>{t("reports.sectionError")}</span>
      <button className="button-secondary" onClick={onRetry}>{t("common.retry")}</button>
    </div>
  );
}

function InlineState({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface p-12 text-center shadow-subtle">
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="h-16 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton height={224} />
        <ChartSkeleton height={224} />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function formatMinutes(minutes: number | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (minutes === null) return "—";
  if (minutes < 60) return t("reports.duration.minutes", { count: Math.round(minutes) });
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0
    ? t("reports.duration.hours", { count: hours })
    : `${t("reports.duration.hours", { count: hours })} ${t("reports.duration.minutes", { count: rest })}`;
}
