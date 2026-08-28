import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChartEmptyState } from "@/components/shared/charts";
import type { ReportsOverview } from "../reports.types";
import { ReportPanel } from "./report-primitives";

export function CustomerSatisfaction({
  satisfaction,
}: {
  satisfaction: ReportsOverview["satisfaction"];
}) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  const rating = satisfaction.averageRating;
  const filled = rating === null ? 0 : Math.round(rating);

  return (
    <ReportPanel
      title={t("reports.satisfactionTitle")}
      description={t("reports.satisfactionDescription")}
    >
      {satisfaction.responseCount === 0 ? (
        <ChartEmptyState description={t("reports.emptySatisfaction")} minHeight="10rem" />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_1fr] md:gap-8">
          <div className="space-y-2">
            <p className="text-4xl font-semibold tracking-tight text-foreground">
              <bdi>{rating === null ? "—" : nf.format(rating)}</bdi>
              <span className="text-xl font-normal text-muted-foreground"> / 5</span>
            </p>
            <p className="text-lg leading-none tracking-widest text-warning" aria-hidden="true">
              {"★".repeat(filled)}
              <span className="text-border-strong">{"★".repeat(Math.max(0, 5 - filled))}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t("reports.satisfactionSummary", {
                rating: satisfaction.averageRating,
                count: satisfaction.responseCount,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("reports.kpis.satisfactionResponses", { count: satisfaction.responseCount })}
            </p>
          </div>

          <div className="md:border-s md:border-border md:ps-8">
            <h4 className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("reports.satisfaction.distributionLabel")}
            </h4>
            <div className="mt-3 space-y-2">
              {[...satisfaction.distribution].reverse().map((row) => {
                const pct = satisfaction.responseCount
                  ? Math.round((row.count / satisfaction.responseCount) * 100)
                  : 0;
                return (
                  <div key={row.rating} className="flex items-center gap-3 text-sm">
                    <span className="flex w-10 shrink-0 items-center gap-1 tabular-nums font-medium text-muted-foreground">
                      <bdi>{nf.format(row.rating)}</bdi>
                      <span aria-hidden="true">★</span>
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-end tabular-nums font-semibold text-foreground">
                      <bdi>{nf.format(row.count)}</bdi>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ReportPanel>
  );
}
