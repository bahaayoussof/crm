import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ReportsOverview } from "../reports.types";
import { Duration } from "./duration";

function Kpi({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-h-[5.25rem] flex-col justify-between rounded-lg border border-border bg-card p-4">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-0.5">
        <p
          className={cn(
            "text-2xl font-semibold leading-tight tracking-tight text-foreground",
            valueClassName,
          )}
        >
          {typeof value === "string" ? <bdi>{value}</bdi> : value}
        </p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function ReportKpiGrid({ kpis }: { kpis: ReportsOverview["kpis"] }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  return (
    <section
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      aria-label={t("reports.kpisLabel")}
    >
      <Kpi label={t("reports.kpis.createdTickets")} value={nf.format(kpis.createdTickets)} />
      <Kpi label={t("reports.kpis.resolvedTickets")} value={nf.format(kpis.resolvedTickets)} />
      <Kpi
        label={t("reports.kpis.slaCompliance")}
        value={kpis.slaCompliancePct === null ? "—" : `${nf.format(kpis.slaCompliancePct)}%`}
      />
      <Kpi
        label={t("reports.kpis.averageResponse")}
        value={<Duration minutes={kpis.averageFirstResponseMinutes} />}
        valueClassName="text-xl"
      />
      <Kpi
        label={t("reports.kpis.satisfaction")}
        value={
          kpis.satisfaction.averageRating === null
            ? "—"
            : `${nf.format(kpis.satisfaction.averageRating)} / 5`
        }
        sub={t("reports.kpis.satisfactionResponses", { count: kpis.satisfaction.responseCount })}
      />
    </section>
  );
}
