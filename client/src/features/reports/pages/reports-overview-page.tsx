import { useTranslation } from "react-i18next";
import { useReportsOverview } from "../reports-hooks";
import { useReportsRangeParams } from "../hooks/use-reports-range-params";
import { ReportSection, InlineState } from "../components/report-primitives";


import { ReportKpiGrid } from "../components/report-kpi-grid";
import { TicketVolumeChart } from "../components/ticket-volume-chart";
import { StatusDistributionChart } from "../components/status-distribution-chart";
import { CustomerSatisfaction } from "../components/customer-satisfaction";
import { ChartSkeleton } from "@/components/shared/charts";

export function ReportsOverviewPage() {
  const { t } = useTranslation();
  const { rangeParams } = useReportsRangeParams();
  const overview = useReportsOverview(rangeParams);

  if (overview.isLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ChartSkeleton height={320} />
          </div>
          <div>
            <ChartSkeleton height={320} />
          </div>
        </div>
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (overview.isError) {
    return (
      <InlineState text={t("reports.loadError")}>
        <button
          type="button"
          className="button-secondary"
          onClick={() => overview.refetch()}
        >
          {t("common.retry")}
        </button>
      </InlineState>
    );
  }

  if (!overview.data) return null;

  return (
    <div className="space-y-8">
      {/* 1. KPI summary */}
      <ReportKpiGrid kpis={overview.data.kpis} />

      {/* 2. Trends & Status Distribution */}
      <ReportSection
        title={t("reports.sections.trends")}
        description={t("reports.sections.trendsDescription")}
        labelledBy="reports-trends-heading"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TicketVolumeChart points={overview.data.ticketVolume ?? overview.data.volume} />
          </div>
          <div>
            <StatusDistributionChart distribution={overview.data.statusDistribution} />
          </div>
        </div>

      </ReportSection>

      {/* 3. Customer Satisfaction */}
      <ReportSection
        title={t("reports.sections.feedback")}
        labelledBy="reports-feedback-heading"
      >
        <CustomerSatisfaction satisfaction={overview.data.satisfaction} />
      </ReportSection>
    </div>
  );
}
