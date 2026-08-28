import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/shared/page-header";
import { useAgentReports, useReportsOverview, useSlaReports, useTicketReports } from "./reports-hooks";
import type { ReportsRangeParams } from "./reports.types";
import type { DateRange } from "@/components/date-picker/date-range-picker";
import { ReportSection, InlineState, ReportsSkeleton } from "./components/report-primitives";
import { ReportToolbar } from "./components/report-toolbar";
import { ReportKpiGrid } from "./components/report-kpi-grid";
import { TicketVolumeChart } from "./components/ticket-volume-chart";
import { StatusDistributionChart } from "./components/status-distribution-chart";
import { SlaPerformance } from "./components/sla-performance";
import { CustomerSatisfaction } from "./components/customer-satisfaction";
import { AgentPerformanceTable } from "./components/agent-performance-table";
import { TicketBreakdown } from "./components/ticket-breakdown";

const PRESETS = [7, 30, 90] as const;

/** Local calendar day → the same day at 00:00:00 UTC (matches the old date-input serialization). */
function toUtcMidnightIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T00:00:00.000Z`;
}

export function ReportsPage() {
  const { t } = useTranslation();
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
    const nextParams = new URLSearchParams(params);
    if (next.from) nextParams.set("from", toUtcMidnightIso(next.from));
    else nextParams.delete("from");
    if (next.to) nextParams.set("to", toUtcMidnightIso(next.to));
    else nextParams.delete("to");
    setParams(nextParams);
  };

  if (overview.isLoading) {
    return (
      <main className="page-container 2xl:max-w-[88rem]" aria-label={t("common.loading")}>
        <ReportsSkeleton />
      </main>
    );
  }

  if (overview.isError || !overview.data) {
    return (
      <main className="page-container 2xl:max-w-[88rem]">
        <InlineState text={t("reports.loadError")}>
          <button className="button-secondary" onClick={() => overview.refetch()}>
            {t("common.retry")}
          </button>
        </InlineState>
      </main>
    );
  }

  const data = overview.data;

  return (
    <main className="page-container space-y-10 2xl:max-w-[88rem]">
      <PageHeader title={t("reports.title")} description={t("reports.description")} />

      <ReportToolbar
        presets={PRESETS}
        activePreset={activePreset}
        onPreset={applyPreset}
        rangeValue={rangeValue}
        onRangeChange={setRange}
        range={range}
        hasCustomRange={Boolean(range.from || range.to)}
        onReset={() => setParams({})}
      />

      <ReportKpiGrid kpis={data.kpis} />

      <ReportSection
        title={t("reports.sections.trends")}
        description={t("reports.sections.trendsDescription")}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <TicketVolumeChart points={data.ticketVolume} className="lg:col-span-2" />
          <StatusDistributionChart distribution={data.statusDistribution} />
        </div>
      </ReportSection>

      <ReportSection title={t("reports.slaTitle")} description={t("reports.slaDescription")}>
        <SlaPerformance
          data={sla.data}
          isError={sla.isError}
          isLoading={sla.isLoading}
          onRetry={() => sla.refetch()}
        />
      </ReportSection>

      <ReportSection title={t("reports.agentsTitle")} description={t("reports.agentsDescription")}>
        <AgentPerformanceTable
          data={agents.data}
          isError={agents.isError}
          isLoading={agents.isLoading}
          onRetry={() => agents.refetch()}
        />
      </ReportSection>

      <ReportSection title={t("reports.breakdownTitle")}>
        <TicketBreakdown
          data={tickets.data}
          isError={tickets.isError}
          isLoading={tickets.isLoading}
          onRetry={() => tickets.refetch()}
        />
      </ReportSection>

      <ReportSection title={t("reports.sections.feedback")}>
        <CustomerSatisfaction satisfaction={data.satisfaction} />
      </ReportSection>
    </main>
  );
}
