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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { TicketStatus } from "@/features/tickets/ticket.types";
import type { DashboardOverview } from "../dashboard.types";

/** Statuses that represent live, in-flight work — the donut only ever charts these. */
const ACTIVE_STATUSES: readonly TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "ESCALATED",
];

export function TicketStatusDonut({ data }: { data: DashboardOverview }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const { rows, total } = useMemo(() => {
    const counts = new Map(data.statusDistribution.map((item) => [item.status, item.count]));
    const active = CANONICAL_STATUS_ORDER.filter((status) => ACTIVE_STATUSES.includes(status))
      .map((status) => ({
        status,
        count: counts.get(status) ?? 0,
        label: t(`tickets.status.${status}`),
        color: getStatusChartColor(status),
      }))
      .filter((item) => item.count > 0);
    return { rows: active, total: active.reduce((sum, item) => sum + item.count, 0) };
  }, [data.statusDistribution, t]);

  return (
    <Card aria-labelledby="dashboard-donut-title" aria-describedby="dashboard-donut-desc">
      <CardHeader>
        <CardTitle id="dashboard-donut-title">{t("dashboard.donut.title")}</CardTitle>
        <CardDescription id="dashboard-donut-desc">{t("dashboard.donut.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="flex flex-col items-center gap-5" data-testid="status-chart">
            <div className="relative size-55 shrink-0">
              <ChartContainer label={t("dashboard.donut.title")}>
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="count"
                    nameKey="label"
                    innerRadius="68%"
                    outerRadius="100%"
                    paddingAngle={rows.length > 1 ? 2 : 0}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {rows.map((entry) => (
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
                <span className="text-[11px] text-muted-foreground">{t("dashboard.donut.centerLabel")}</span>
              </div>
            </div>

            <ul className="w-full min-w-0 space-y-2">
              {rows.map((row) => {
                const pct = total ? Math.round((row.count / total) * 100) : 0;
                return (
                  <li key={row.status} className="flex items-center gap-2.5 text-sm">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      <bdi>{nf.format(row.count)}</bdi>
                    </span>
                    <span className="w-11 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                      <bdi>{nf.format(pct)}%</bdi>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <ChartEmptyState description={t("dashboard.emptyDistribution")} minHeight="14rem" />
        )}
      </CardContent>
    </Card>
  );
}
