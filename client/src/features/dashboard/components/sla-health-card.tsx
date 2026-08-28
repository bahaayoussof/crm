import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartEmptyState } from "@/components/shared/charts";
import type { DashboardOverview } from "../dashboard.types";

const SEGMENTS = [
  { key: "ON_TRACK", color: "var(--success)" },
  { key: "AT_RISK", color: "var(--warning)" },
  { key: "BREACHED", color: "var(--danger)" },
] as const;

/**
 * Compact SLA posture: a single segmented compliance bar plus exact counts.
 * Colour never carries meaning alone — every state is also labelled with its number.
 */
export function SlaHealthCard({ data }: { data: DashboardOverview }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const breached = data.metrics.slaBreached;
  const atRisk = data.metrics.slaAtRisk;
  const onTrack = Math.max(0, data.metrics.openTickets - breached - atRisk);
  const counts: Record<(typeof SEGMENTS)[number]["key"], number> = {
    ON_TRACK: onTrack,
    AT_RISK: atRisk,
    BREACHED: breached,
  };
  const total = onTrack + atRisk + breached;
  const compliancePct = total > 0 ? Math.round((onTrack / total) * 100) : null;

  const summary = SEGMENTS.map(
    ({ key }) => `${t(`dashboard.slaStates.${key}`)} ${nf.format(counts[key])}`,
  ).join(" · ");

  return (
    <Card aria-labelledby="dashboard-sla-title" aria-describedby="dashboard-sla-desc">
      <CardHeader>
        <CardTitle id="dashboard-sla-title">{t("dashboard.slaHealthTitle")}</CardTitle>
        <CardDescription id="dashboard-sla-desc">{t("dashboard.slaHealthDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <div className="space-y-4" role="img" aria-label={`${compliancePct}% — ${summary}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t("dashboard.slaCompliance")}</span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                <bdi>{nf.format(compliancePct ?? 0)}%</bdi>
              </span>
            </div>

            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle" aria-hidden="true">
              {SEGMENTS.map(({ key, color }) =>
                counts[key] > 0 ? (
                  <span key={key} style={{ flexGrow: counts[key], backgroundColor: color }} />
                ) : null,
              )}
            </div>

            <dl className="divide-y divide-border-subtle">
              {SEGMENTS.map(({ key, color }) => (
                <div key={key} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    {t(`dashboard.slaStates.${key}`)}
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    <bdi>{nf.format(counts[key])}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <ChartEmptyState description={t("dashboard.emptySlaHealth")} minHeight="12rem" />
        )}
      </CardContent>
    </Card>
  );
}
