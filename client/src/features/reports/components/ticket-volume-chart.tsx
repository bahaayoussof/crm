import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartEmptyState,
  CHART_THEME_TOKENS,
} from "@/components/shared/charts";
import type { VolumePoint } from "../reports.types";
import { ReportPanel } from "./report-primitives";

export function TicketVolumeChart({
  points,
  className,
}: {
  points: VolumePoint[];
  className?: string;
}) {
  const { t } = useTranslation();
  const data = useMemo(
    () => points.map((point) => ({ ...point, label: point.date.slice(5) })),
    [points],
  );

  return (
    <ReportPanel
      title={t("reports.volumeTitle")}
      description={t("reports.volumeDescription")}
      className={className}
    >
      {data.length ? (
        <div className="h-72 sm:h-80 lg:h-[22rem]" data-testid="volume-chart">
          <ChartContainer label={t("reports.volumeTitle")}>
            <BarChart data={data} margin={{ left: -8, right: 12, top: 8, bottom: 4 }} barGap={2}>
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
              <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--surface-hover)" }} />
              <Legend content={<ChartLegendContent />} verticalAlign="top" height={28} />
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
        <ChartEmptyState description={t("reports.emptyVolume")} minHeight="18rem" />
      )}
    </ReportPanel>
  );
}
