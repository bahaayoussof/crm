import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartEmptyState,
  CHART_THEME_TOKENS,
} from "@/components/shared/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardActivityPoint } from "../dashboard.types";

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

/**
 * The dashboard's primary analytics view: opened vs resolved tickets per day.
 * The server always returns a 30-day series; the 7/14/30 control just slices the
 * tail client-side, so switching ranges never refetches.
 */
export function TicketActivityChart({ points }: { points: DashboardActivityPoint[] }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState<Range>(14);

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const windowed = useMemo(() => points.slice(-range), [points, range]);
  const data = useMemo(
    () => windowed.map((point) => ({ ...point, label: point.date.slice(5) })),
    [windowed],
  );
  const totals = useMemo(
    () => ({
      opened: windowed.reduce((sum, point) => sum + point.opened, 0),
      resolved: windowed.reduce((sum, point) => sum + point.resolved, 0),
    }),
    [windowed],
  );
  const hasActivity = totals.opened > 0 || totals.resolved > 0;

  return (
    <Card aria-labelledby="dashboard-activity-title" aria-describedby="dashboard-activity-desc">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle id="dashboard-activity-title">{t("dashboard.activity.title")}</CardTitle>
          <CardDescription id="dashboard-activity-desc">
            {t("dashboard.activity.description")}
          </CardDescription>
        </div>
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-surface-subtle p-0.5"
          role="group"
          aria-label={t("dashboard.activity.rangeLabel")}
        >
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              aria-pressed={range === value}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === value
                  ? "bg-card text-foreground shadow-subtle"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("dashboard.activity.rangeDays", { count: value })}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {hasActivity ? (
          <>
            <div className="h-64 sm:h-72 lg:h-80" data-testid="activity-chart">
              <ChartContainer label={t("dashboard.activity.title")}>
                <AreaChart data={data} margin={{ left: -8, right: 12, top: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME_TOKENS.grid} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: CHART_THEME_TOKENS.axis }}
                    tickMargin={10}
                    minTickGap={24}
                    interval="preserveStartEnd"
                    stroke={CHART_THEME_TOKENS.axis}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: CHART_THEME_TOKENS.axis }}
                    width={36}
                    tickMargin={4}
                    stroke={CHART_THEME_TOKENS.axis}
                  />
                  <Tooltip content={<ChartTooltipContent />} cursor={{ stroke: "var(--surface-hover)" }} />
                  <Legend content={<ChartLegendContent />} verticalAlign="top" height={28} />
                  <Area
                    name={t("dashboard.activity.opened")}
                    type="monotone"
                    dataKey="opened"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="var(--chart-1)"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                  <Area
                    name={t("dashboard.activity.resolved")}
                    type="monotone"
                    dataKey="resolved"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="var(--chart-2)"
                    fillOpacity={0.12}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ChartContainer>
            </div>
            <p className="sr-only">
              {t("dashboard.activity.srSummary", {
                opened: nf.format(totals.opened),
                resolved: nf.format(totals.resolved),
                days: nf.format(range),
              })}
            </p>
          </>
        ) : (
          <ChartEmptyState description={t("dashboard.activity.empty")} minHeight="16rem" />
        )}
      </CardContent>
    </Card>
  );
}
