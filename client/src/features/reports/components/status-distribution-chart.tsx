import { useMemo } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartContainer,
  ChartTooltipContent,
  ChartEmptyState,
  CANONICAL_STATUS_ORDER,
  getStatusChartColor,
} from "@/components/shared/charts";
import type { StatusCount } from "../reports.types";
import { ReportPanel } from "./report-primitives";

export function StatusDistributionChart({ distribution }: { distribution: StatusCount[] }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const { data, total } = useMemo(() => {
    const statusMap = new Map(distribution.map((row) => [row.status, row.count]));
    const rows = CANONICAL_STATUS_ORDER.filter((status) => statusMap.has(status)).map((status) => ({
      status,
      count: statusMap.get(status) ?? 0,
      label: t(`tickets.status.${status}`),
      color: getStatusChartColor(status),
    }));
    return { data: rows, total: rows.reduce((sum, row) => sum + row.count, 0) };
  }, [distribution, t]);

  return (
    <ReportPanel title={t("reports.statusTitle")}>
      {data.length ? (
        <div
          className="flex h-full flex-col items-center justify-center gap-2"
          data-testid="status-chart"
        >
          <div className="relative size-45 shrink-0">
            <ChartContainer label={t("reports.statusTitle")}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="68%"
                  outerRadius="100%"
                  paddingAngle={data.length > 1 ? 2 : 0}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {data.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-foreground">
                <bdi>{nf.format(total)}</bdi>
              </span>
              <span className="text-[11px] text-muted-foreground">{t("reports.total")}</span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-2">
            {data.map((row) => {
              const pct = total ? Math.round((row.count / total) * 100) : 0;
              return (
                <li key={row.status} className="flex items-center gap-2.5 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                  <span className="shrink-0 font-semibold text-foreground">
                    <bdi>{nf.format(row.count)}</bdi>
                  </span>
                  <span className="w-11 shrink-0 text-end text-xs text-muted-foreground">
                    <bdi>{nf.format(pct)}%</bdi>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <ChartEmptyState description={t("reports.emptyStatus")} minHeight="12rem" />
      )}
    </ReportPanel>
  );
}
