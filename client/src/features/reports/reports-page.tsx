import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TicketPriorityText } from "../tickets/ticket-badges";
import { formatTicketDate } from "../tickets/ticket-format";
import { useAgentReports, useReportsOverview, useSlaReports, useTicketReports } from "./reports-hooks";
import type { AgentReportRow, ReportsRangeParams } from "./reports.types";

const PRESETS = [7, 30, 90] as const;

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

  const setBound = (key: "from" | "to", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, new Date(value).toISOString());
    else next.delete(key);
    setParams(next);
  };
  const boundValue = (key: "from" | "to") => {
    const raw = params.get(key);
    return raw ? raw.slice(0, 10) : "";
  };

  if (overview.isLoading) {
    return <main className="page-container" aria-label={t("common.loading")}><Skeleton /></main>;
  }
  if (overview.isError || !overview.data) {
    return <main className="page-container"><InlineState text={t("reports.loadError")}><button className="button-secondary" onClick={() => overview.refetch()}>{t("common.retry")}</button></InlineState></main>;
  }

  const data = overview.data;
  const k = data.kpis;
  const volume = data.ticketVolume.map((point) => ({ ...point, label: point.date.slice(5) }));
  const statusChart = data.statusDistribution.map((row) => ({ ...row, label: t(`tickets.status.${row.status}`) }));

  return <main className="page-container space-y-6">
    <header className="border-b pb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("reports.title")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("reports.description")}</p>
    </header>

    <section className="rounded-md border bg-white p-4" aria-label={t("reports.filters.label")}>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("reports.filters.presetLabel")}>
          {PRESETS.map((days) => <button
            key={days}
            type="button"
            aria-pressed={activePreset === days}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium ${activePreset === days ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => applyPreset(days)}
          >{t("reports.filters.lastDays", { count: days })}</button>)}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("reports.filters.from")}
          <input type="date" className="input" value={boundValue("from")} max={boundValue("to") || undefined} onChange={(event) => setBound("from", event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t("reports.filters.to")}
          <input type="date" className="input" value={boundValue("to")} min={boundValue("from") || undefined} onChange={(event) => setBound("to", event.target.value)} />
        </label>
        {(range.from || range.to) && <button type="button" className="button-ghost px-2 text-xs" onClick={() => setParams({})}>{t("reports.filters.reset")}</button>}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
        {formatTicketDate(data.range.from, i18n.language)} – {formatTicketDate(data.range.to, i18n.language)} · {t("reports.filters.timezone")}
      </p>
    </section>

    <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border lg:grid-cols-5" aria-label={t("reports.kpisLabel")}>
      <Kpi label={t("reports.kpis.createdTickets")} value={nf.format(k.createdTickets)} />
      <Kpi label={t("reports.kpis.resolvedTickets")} value={nf.format(k.resolvedTickets)} />
      <Kpi label={t("reports.kpis.slaCompliance")} value={k.slaCompliancePct === null ? "—" : `${nf.format(k.slaCompliancePct)}%`} />
      <Kpi label={t("reports.kpis.averageResponse")} value={formatMinutes(k.averageFirstResponseMinutes, t)} />
      <Kpi label={t("reports.kpis.satisfaction")} value={k.satisfaction.averageRating === null ? "—" : `${nf.format(k.satisfaction.averageRating)} / 5`} sub={t("reports.kpis.satisfactionResponses", { count: k.satisfaction.responseCount })} />
    </section>

    <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <Panel title={t("reports.volumeTitle")} description={t("reports.volumeDescription")}>
        {volume.some((point) => point.created || point.resolved)
          ? <div className="mt-4 h-64" data-testid="volume-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar name={t("reports.legend.created")} dataKey="created" fill="var(--primary)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar name={t("reports.legend.resolved")} dataKey="resolved" fill="#16a34a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          : <p className="mt-6 text-sm text-muted-foreground">{t("reports.emptyVolume")}</p>}
        <ul className="sr-only">{volume.map((point) => <li key={point.date}>{point.date}: {t("reports.legend.created")} {point.created}, {t("reports.legend.resolved")} {point.resolved}</li>)}</ul>
      </Panel>

      <Panel title={t("reports.statusTitle")}>
        {statusChart.length
          ? <><div className="mt-4 h-56" data-testid="status-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChart} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={104} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 3, 3, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="sr-only">{statusChart.map((row) => <li key={row.status}>{row.label}: {row.count}</li>)}</ul></>
          : <p className="mt-6 text-sm text-muted-foreground">{t("reports.emptyStatus")}</p>}
      </Panel>
    </section>

    <section className="grid gap-6 lg:grid-cols-2">
      <Panel title={t("reports.slaTitle")} description={t("reports.slaDescription")}>
        {sla.isError || !sla.data
          ? <SectionError onRetry={() => sla.refetch()} loading={sla.isLoading} />
          : <div className="mt-4 space-y-4">
              <SlaBar label={t("reports.sla.firstResponse")} tally={sla.data.firstResponse} nf={nf} t={t} />
              <SlaBar label={t("reports.sla.resolution")} tally={sla.data.resolution} nf={nf} t={t} />
              <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
                <div><dt className="text-muted-foreground">{t("reports.sla.avgFirstResponse")}</dt><dd className="font-semibold tabular-nums">{formatMinutes(sla.data.averageFirstResponseMinutes, t)}</dd></div>
                <div><dt className="text-muted-foreground">{t("reports.sla.avgResolution")}</dt><dd className="font-semibold tabular-nums">{formatMinutes(sla.data.averageResolutionMinutes, t)}</dd></div>
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead className="bg-muted text-xs text-muted-foreground"><tr>
                    {[t("tickets.priorityLabel"), t("reports.sla.metShort"), t("reports.sla.breachedShort"), t("reports.sla.complianceShort")].map((label) => <th key={label} className="px-3 py-2 text-start">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y">{sla.data.byPriority.map((row) => <tr key={row.priority}>
                    <td className="px-3 py-2"><TicketPriorityText priority={row.priority} /></td>
                    <td className="px-3 py-2 tabular-nums">{nf.format(row.firstResponseMet)}</td>
                    <td className="px-3 py-2 tabular-nums">{nf.format(row.firstResponseBreached)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.compliancePct === null ? "—" : `${nf.format(row.compliancePct)}%`}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </div>}
      </Panel>

      <Panel title={t("reports.satisfactionTitle")} description={t("reports.satisfactionDescription")}>
        {data.satisfaction.responseCount === 0
          ? <p className="mt-6 text-sm text-muted-foreground">{t("reports.emptySatisfaction")}</p>
          : <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">{t("reports.satisfactionSummary", { rating: data.satisfaction.averageRating, count: data.satisfaction.responseCount })}</p>
              {[...data.satisfaction.distribution].reverse().map((row) => {
                const pct = data.satisfaction.responseCount ? Math.round((row.count / data.satisfaction.responseCount) * 100) : 0;
                return <div key={row.rating} className="flex items-center gap-3 text-sm">
                  <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{nf.format(row.rating)} ★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
                  <span className="w-10 shrink-0 text-end tabular-nums">{nf.format(row.count)}</span>
                </div>;
              })}
            </div>}
      </Panel>
    </section>

    <Panel title={t("reports.agentsTitle")} description={t("reports.agentsDescription")}>
      {agents.isError || !agents.data
        ? <SectionError onRetry={() => agents.refetch()} loading={agents.isLoading} />
        : agents.data.agents.length === 0
          ? <p className="mt-6 text-sm text-muted-foreground">{t("reports.emptyAgents")}</p>
          : <AgentTable rows={agents.data.agents} nf={nf} />}
    </Panel>

    <Panel title={t("reports.breakdownTitle")}>
      {tickets.isError || !tickets.data
        ? <SectionError onRetry={() => tickets.refetch()} loading={tickets.isLoading} />
        : <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold">{t("reports.byPriority")}</h3>
              <table className="mt-2 w-full text-sm">
                <thead className="bg-muted text-xs text-muted-foreground"><tr>{[t("tickets.priorityLabel"), t("reports.legend.created"), t("reports.legend.resolved")].map((label) => <th key={label} className="px-3 py-2 text-start">{label}</th>)}</tr></thead>
                <tbody className="divide-y">{tickets.data.byPriority.map((row) => <tr key={row.priority}>
                  <td className="px-3 py-2"><TicketPriorityText priority={row.priority} /></td>
                  <td className="px-3 py-2 tabular-nums">{nf.format(row.created)}</td>
                  <td className="px-3 py-2 tabular-nums">{nf.format(row.resolved)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <div>
              <h3 className="text-sm font-semibold">{t("reports.byCategory")}</h3>
              {tickets.data.byCategory.length === 0
                ? <p className="mt-2 text-sm text-muted-foreground">{t("reports.emptyStatus")}</p>
                : <table className="mt-2 w-full text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground"><tr>{[t("tickets.category"), t("reports.legend.created")].map((label) => <th key={label} className="px-3 py-2 text-start">{label}</th>)}</tr></thead>
                    <tbody className="divide-y">{tickets.data.byCategory.map((row) => <tr key={row.categoryId ?? "uncategorized"}>
                      <td className="px-3 py-2"><span className="line-clamp-1 break-words" title={row.categoryName ?? t("reports.uncategorized")}>{row.categoryName ?? t("reports.uncategorized")}</span></td>
                      <td className="px-3 py-2 tabular-nums">{nf.format(row.created)}</td>
                    </tr>)}</tbody>
                  </table>}
            </div>
          </div>}
    </Panel>
  </main>;
}

function AgentTable({ rows, nf }: { rows: AgentReportRow[]; nf: Intl.NumberFormat }) {
  const { t } = useTranslation();
  const headers = [t("reports.agents.name"), t("reports.agents.assigned"), t("reports.agents.resolved"), t("reports.agents.open"), t("reports.agents.slaMet"), t("reports.agents.avgResponse")];
  return <>
    <div className="mt-3 hidden overflow-x-auto rounded-md border bg-white p-px md:block">
      <table className="w-full min-w-[52rem] table-fixed text-sm">
        <colgroup><col className="w-56" /><col className="w-24" /><col className="w-24" /><col className="w-20" /><col className="w-28" /><col className="w-32" /></colgroup>
        <thead className="bg-muted text-xs text-muted-foreground"><tr>{headers.map((label) => <th key={label} className="px-4 py-2 text-start">{label}</th>)}</tr></thead>
        <tbody className="divide-y">{rows.map((row) => <tr key={row.agentId}>
          <td className="px-4 py-2"><span className="line-clamp-1 break-words" title={row.agentName}>{row.agentName}</span></td>
          <td className="px-4 py-2 tabular-nums">{nf.format(row.assigned)}</td>
          <td className="px-4 py-2 tabular-nums">{nf.format(row.resolved)}</td>
          <td className="px-4 py-2 tabular-nums">{nf.format(row.open)}</td>
          <td className="px-4 py-2 tabular-nums">{row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}</td>
          <td className="px-4 py-2 tabular-nums">{formatMinutes(row.averageFirstResponseMinutes, t)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <ul className="mt-3 grid gap-3 md:hidden">{rows.map((row) => <li key={row.agentId} className="rounded-md border bg-white p-4">
      <p className="font-medium" dir="auto">{row.agentName}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("reports.agents.assigned")}</dt><dd className="tabular-nums">{nf.format(row.assigned)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("reports.agents.resolved")}</dt><dd className="tabular-nums">{nf.format(row.resolved)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("reports.agents.open")}</dt><dd className="tabular-nums">{nf.format(row.open)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">{t("reports.agents.slaMet")}</dt><dd className="tabular-nums">{row.slaMetPct === null ? "—" : `${nf.format(row.slaMetPct)}%`}</dd></div>
      </dl>
    </li>)}</ul>
  </>;
}

function SlaBar({ label, tally, nf, t }: { label: string; tally: { met: number; breached: number; pending: number; total: number; compliancePct: number | null }; nf: Intl.NumberFormat; t: (key: string, opts?: Record<string, unknown>) => string }) {
  const total = tally.total || 1;
  const segments = [
    { key: "met", value: tally.met, color: "bg-green-500" },
    { key: "breached", value: tally.breached, color: "bg-red-500" },
    { key: "pending", value: tally.pending, color: "bg-amber-400" },
  ];
  return <div>
    <div className="flex items-baseline justify-between text-sm">
      <span className="font-medium">{label}</span>
      <span className="tabular-nums text-muted-foreground">{tally.compliancePct === null ? "—" : `${nf.format(tally.compliancePct)}%`}</span>
    </div>
    <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${label}: ${t("reports.sla.metShort")} ${tally.met}, ${t("reports.sla.breachedShort")} ${tally.breached}, ${t("reports.sla.pendingShort")} ${tally.pending}`}>
      {segments.map((segment) => segment.value > 0 && <span key={segment.key} className={segment.color} style={{ width: `${(segment.value / total) * 100}%` }} />)}
    </div>
    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
      {t("reports.sla.metShort")} {nf.format(tally.met)} · {t("reports.sla.breachedShort")} {nf.format(tally.breached)} · {t("reports.sla.pendingShort")} {nf.format(tally.pending)}
    </p>
  </div>;
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-w-0 bg-white px-4 py-3">
    <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr">{value}</p>
    {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
  </div>;
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-md border bg-white p-5">
    <h2 className="text-base font-semibold">{title}</h2>
    {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    {children}
  </section>;
}

function SectionError({ onRetry, loading }: { onRetry: () => void; loading?: boolean }) {
  const { t } = useTranslation();
  if (loading) return <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>;
  return <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
    <span>{t("reports.sectionError")}</span>
    <button className="button-secondary" onClick={onRetry}>{t("common.retry")}</button>
  </div>;
}

function InlineState({ text, children }: { text: string; children: React.ReactNode }) {
  return <section className="rounded-md border bg-white px-5 py-12 text-center"><p className="text-sm text-muted-foreground">{text}</p><div className="mt-4">{children}</div></section>;
}

function Skeleton() {
  return <div className="space-y-6">
    <div className="h-16 animate-pulse rounded-md bg-muted" />
    <div className="h-16 animate-pulse rounded-md bg-muted" />
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />)}</div>
    <div className="h-64 animate-pulse rounded-md bg-muted" />
    <div className="h-72 animate-pulse rounded-md bg-muted" />
  </div>;
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
