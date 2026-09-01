import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDurationParts } from "@/features/reports/components/report-format";
import type { DashboardAgentPerformance } from "../dashboard.types";

/**
 * Personal performance summary for the logged-in agent — a small work-console
 * panel, NOT an analytics view. Every number is the agent's own; no ranking, no
 * team comparison, no organization-wide totals (those stay in Reports for
 * ADMIN/MANAGER). Renders nothing when the payload has no agent block.
 */
export function AgentPerformanceCard({ performance }: { performance?: DashboardAgentPerformance }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  if (!performance) return null;

  const duration = (minutes: number | null) => formatDurationParts(minutes, t, nf).join(" ");
  const rows: Array<{ key: string; value: string }> = [
    { key: "avgFirstResponse", value: duration(performance.avgFirstResponseMinutes) },
    { key: "avgResolution", value: duration(performance.avgResolutionMinutes) },
    { key: "resolved", value: nf.format(performance.resolvedCount) },
    {
      key: "slaCompliance",
      value: performance.slaCompliancePct === null ? "—" : `${nf.format(performance.slaCompliancePct)}%`,
    },
    {
      key: "csat",
      value:
        performance.csat.averageRating === null
          ? "—"
          : `${nf.format(performance.csat.averageRating)} (${nf.format(performance.csat.responseCount)})`,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.agentPerformance.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
              <dt className="text-sm text-muted-foreground">{t(`dashboard.agentPerformance.${row.key}`)}</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                <bdi>{row.value}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[11px] text-muted-foreground">
          {t("dashboard.agentPerformance.window", { count: performance.windowDays })}
        </p>
      </CardContent>
    </Card>
  );
}
