import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import type { DashboardOverview } from "../dashboard.types";

/**
 * Plain-language roll-up of counts already in the overview payload. Metrics the
 * dashboard endpoint does not provide (avg first response / resolution) are
 * intentionally omitted rather than shown as placeholders.
 */
export function OperationalSummary({
  data,
  isAgent,
}: {
  data: DashboardOverview;
  isAgent: boolean;
}) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const escalated =
    data.statusDistribution.find((item) => item.status === "ESCALATED")?.count ?? 0;

  const rows: Array<{ key: string; label: string; value: number }> = [
    { key: "waiting", label: t("dashboard.metrics.waitingCustomer"), value: data.metrics.waitingCustomer },
    isAgent
      ? { key: "assigned", label: t("dashboard.metrics.assignedToMe"), value: data.metrics.assignedToMe }
      : { key: "unassigned", label: t("dashboard.metrics.unassignedTickets"), value: data.metrics.unassignedTickets },
    { key: "escalated", label: t("dashboard.summaryEscalated"), value: escalated },
    { key: "resolvedToday", label: t("dashboard.metrics.resolvedToday"), value: data.metrics.resolvedToday },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.summaryTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0">
              <dt className="text-sm text-muted-foreground">{row.label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-foreground">
                <bdi>{nf.format(row.value)}</bdi>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[11px] text-muted-foreground">
          {t("dashboard.lastUpdated", { value: formatTicketDate(data.generatedAt, i18n.language) })}
        </p>
      </CardContent>
    </Card>
  );
}
