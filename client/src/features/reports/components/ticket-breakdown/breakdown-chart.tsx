import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartEmptyState,
  ChartLegendContent,
  ChartTooltipContent,
  CHART_THEME_TOKENS,
  CHART_PALETTE,
  STATUS_CHART_COLORS,
} from "@/components/shared/charts";
import type { BreakdownItem } from "../../reports.types";
import type { DimensionMeta } from "./breakdown-config";
import { ReportPanel } from "../report-primitives";

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: BreakdownItem }>;
}) {
  const { t, i18n } = useTranslation();
  const row = payload?.[0]?.payload;

  if (!active || !row) return null;

  return (
    <div dir={i18n.dir()}>
      <ChartTooltipContent
        active
        label={row.label}
        payload={[
          {
            name: t("reports.legend.created"),
            value: row.created,
            color: "var(--chart-1)",
            dataKey: "created",
          },
          {
            name: t("reports.legend.resolved"),
            value: row.resolved,
            color: "var(--chart-2)",
            dataKey: "resolved",
          },
          {
            name: t("reports.sla.complianceShort"),
            value: `${row.share}%`,
            color: "var(--chart-3)",
            dataKey: "share",
          },
        ]}
      />
    </div>
  );
}

export function shortenCategoryLabel(label: string, locale: string, maxGraphemes = 14) {
  const segments = Array.from(
    new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(label),
    ({ segment }) => segment
  );

  return segments.length > maxGraphemes
    ? `${segments.slice(0, maxGraphemes - 1).join("")}…`
    : label;
}

interface CategoryAxisTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  locale: string;
  isRtl: boolean;
  axisWidth: number;
}

function CategoryAxisTick({
  x = 0,
  y = 0,
  payload,
  locale,
  isRtl,
  axisWidth,
}: CategoryAxisTickProps) {
  const label = String(payload?.value ?? "");
  const tickX = Number(x);
  const tickY = Number(y);
  const outerInset = 12;
  const plotGap = isRtl ? 24 : 12;
  const labelWidth = Math.max(0, axisWidth - outerInset - plotGap);

  return (
    <foreignObject
      x={tickX - axisWidth + outerInset}
      y={tickY - 10}
      width={labelWidth}
      height={20}
    >
      <div
        dir={isRtl ? "rtl" : "ltr"}
        title={label}
        style={{
          color: CHART_THEME_TOKENS.axis,
          fontSize: 11,
          lineHeight: "20px",
          overflow: "hidden",
          textAlign: "right",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {shortenCategoryLabel(label, locale, 22)}
      </div>
    </foreignObject>
  );
}

export interface BreakdownChartProps {
  items: BreakdownItem[];
  config: DimensionMeta;
  className?: string;
}

export function BreakdownChart({ items, config, className }: BreakdownChartProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === "rtl";

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language]
  );

  const chartData = useMemo(() => {
    return items.map((item, index) => ({
      ...item,
      color:
        config.key === "status" && item.key in STATUS_CHART_COLORS
          ? STATUS_CHART_COLORS[item.key as keyof typeof STATUS_CHART_COLORS]
          : CHART_PALETTE[index % CHART_PALETTE.length],
    }));
  }, [config.key, items]);

  const categoryAxisWidth = useMemo(() => {
    if (config.key !== "category") return 40;

    const longestVisibleLabel = chartData.reduce((longest, item) => {
      const shortened = shortenCategoryLabel(String(item.label ?? item.key), i18n.language, 22);
      return shortened.length > longest.length ? shortened : longest;
    }, "");
    const averageGlyphWidth = isRtl ? 9.5 : 7;
    const minimumWidth = isRtl ? 176 : 132;
    const maximumWidth = isRtl ? 260 : 224;
    const breathingRoom = isRtl ? 48 : 28;

    return Math.min(
      maximumWidth,
      Math.max(
        minimumWidth,
        Math.ceil(longestVisibleLabel.length * averageGlyphWidth + breathingRoom)
      )
    );
  }, [chartData, config.key, i18n.language, isRtl]);

  const totalCreated = useMemo(
    () => items.reduce((sum, item) => sum + item.created, 0),
    [items]
  );

  const hasData = items.some((item) => item.created > 0 || item.resolved > 0);

  if (!hasData) {
    return (
      <ReportPanel title={t(config.labelKey)} className={className}>
        <ChartEmptyState description={t("reports.emptyStatus", { defaultValue: "No data for this range." })} />
      </ReportPanel>
    );
  }

  return (
    <ReportPanel
      title={t(config.labelKey)}
      className={className}
      bodyClassName={config.chartType === "donut" ? "flex flex-col" : undefined}
    >
      {config.chartType === "donut" ? (
        <div className="flex h-full flex-col items-center py-1" data-testid={`breakdown-${config.key}-donut-chart`}>
          <div className="relative size-48 shrink-0 sm:size-52">
            <ChartContainer label={t(config.labelKey)}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="created"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={chartData.length > 1 ? 2 : 0}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-foreground">
                <bdi>{nf.format(totalCreated)}</bdi>
              </span>
              <span className="text-[11px] text-muted-foreground">{t("reports.total")}</span>
            </div>
          </div>

          <ul className="mt-auto grid w-full min-w-0 gap-x-4 gap-y-2 pt-5 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
            {chartData.map((row) => (
              <li key={row.key} className="flex items-center gap-2.5 text-sm">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                <span className="shrink-0 font-semibold text-foreground">
                  <bdi>{nf.format(row.created)}</bdi>
                </span>
                <span className="w-11 shrink-0 text-end text-xs text-muted-foreground">
                  <bdi>{nf.format(row.share)}%</bdi>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div
          className="min-h-[320px]"
          dir="ltr"
          style={{ height: config.key === "category" ? Math.max(340, chartData.length * 44 + 64) : 360 }}
          data-testid={config.key === "category" ? "breakdown-category-horizontal-bar-chart" : "breakdown-bar-chart"}
          data-category-axis-side={config.key === "category" ? "left" : undefined}
        >
          <ChartContainer label={t(config.labelKey)}>
            <BarChart
              data={chartData}
              layout={config.key === "category" ? "vertical" : "horizontal"}
              margin={config.key === "category" ? { left: 0, right: 16, top: 8, bottom: 4 } : { left: 0, right: 16, top: 8, bottom: 4 }}
              barGap={3}
              barCategoryGap={config.key === "category" ? "26%" : "18%"}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={config.key === "category"}
                horizontal={config.key !== "category"}
                stroke={CHART_THEME_TOKENS.grid}
              />
              <XAxis
                dataKey={config.key === "category" ? undefined : "label"}
                type={config.key === "category" ? "number" : "category"}
                allowDecimals={config.key === "category" ? false : undefined}
                tick={{ fontSize: 11, fill: CHART_THEME_TOKENS.axis }}
                tickMargin={10}
                interval={0}
                stroke={CHART_THEME_TOKENS.axis}
              />
              <YAxis
                dataKey={config.key === "category" ? "label" : undefined}
                type={config.key === "category" ? "category" : "number"}
                allowDecimals={config.key === "category" ? undefined : false}
                tick={
                  config.key === "category"
                    ? (props) => (
                        <CategoryAxisTick
                          {...props}
                          locale={i18n.language}
                          isRtl={isRtl}
                          axisWidth={categoryAxisWidth}
                        />
                      )
                    : { fontSize: 11, fill: CHART_THEME_TOKENS.axis }
                }
                width={categoryAxisWidth}
                orientation="left"
                tickMargin={config.key === "category" ? 12 : 4}
                interval={0}
                stroke={CHART_THEME_TOKENS.axis}
              />
              <Tooltip
                content={
                  config.key === "category" ? (
                    <CategoryTooltip />
                  ) : (
                    <ChartTooltipContent />
                  )
                }
                cursor={{ fill: "var(--surface-hover)" }}
              />
              <Legend content={<ChartLegendContent />} verticalAlign="top" height={28} />
              {config.key === "category" ? (
                <>
                  <Bar
                    name={t("reports.legend.created")}
                    dataKey="created"
                    fill="var(--chart-1)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={14}
                    isAnimationActive={false}
                  />
                  <Bar
                    name={t("reports.legend.resolved")}
                    dataKey="resolved"
                    fill="var(--chart-2)"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={14}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <>
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
                </>
              )}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </ReportPanel>
  );
}
