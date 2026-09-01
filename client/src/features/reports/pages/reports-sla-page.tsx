import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSlaReports } from "../reports-hooks";
import { useReportsRangeParams } from "../hooks/use-reports-range-params";
import { ReportSection, InlineState } from "../components/report-primitives";


import { SlaPerformance } from "../components/sla-performance";
import { MetricCard } from "@/components/shared/metric-card";
import { Duration } from "../components/duration";

export function ReportsSlaPage() {
  const { t, i18n } = useTranslation();
  const { rangeParams } = useReportsRangeParams();
  const sla = useSlaReports(rangeParams);

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language]
  );

  if (sla.isLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (sla.isError) {
    return (
      <InlineState text={t("reports.loadError")}>
        <button
          type="button"
          className="button-secondary"
          onClick={() => sla.refetch()}
        >
          {t("common.retry")}
        </button>
      </InlineState>
    );
  }

  if (!sla.data) return null;

  const data = sla.data;

  return (
    <div className="space-y-8">
      {/* 1. SLA Summary KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t("reports.sla.firstResponse")}
          value={data.firstResponse.compliancePct === null ? "—" : `${nf.format(data.firstResponse.compliancePct)}%`}
          trend={`${data.firstResponse.met} ${t("reports.sla.metShort")} · ${data.firstResponse.breached} ${t("reports.sla.breachedShort")}`}
        />
        <MetricCard
          label={t("reports.sla.resolution")}
          value={data.resolution.compliancePct === null ? "—" : `${nf.format(data.resolution.compliancePct)}%`}
          trend={`${data.resolution.met} ${t("reports.sla.metShort")} · ${data.resolution.breached} ${t("reports.sla.breachedShort")}`}
        />
        <MetricCard
          label={t("reports.sla.avgFirstResponse")}
          value={<Duration minutes={data.averageFirstResponseMinutes} />}
        />
        <MetricCard
          label={t("reports.sla.avgResolution")}
          value={<Duration minutes={data.averageResolutionMinutes} />}
        />
      </div>


      {/* 2. Focused SLA performance breakdown and rings */}
      <ReportSection
        title={t("reports.slaTitle")}
        description={t("reports.slaDescription")}
        labelledBy="reports-sla-heading"
      >
        <SlaPerformance
          data={data}
          isError={sla.isError}
          isLoading={sla.isLoading}
          onRetry={() => sla.refetch()}
        />
      </ReportSection>
    </div>
  );
}
