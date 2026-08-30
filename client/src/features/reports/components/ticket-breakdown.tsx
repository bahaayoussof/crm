import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TicketPriorityText } from "../../tickets/ticket-badges";
import type { TicketReports } from "../reports.types";
import { ReportPanel, SectionError } from "./report-primitives";

export function TicketBreakdown({
  data,
  isError,
  isLoading,
  onRetry,
}: {
  data: TicketReports | undefined;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );

  return (
    <ReportPanel>
      {isError || !data ? (
        <SectionError onRetry={onRetry} loading={isLoading} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("reports.byPriority")}</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-1.5 pe-3 text-start font-medium">{t("tickets.priorityLabel")}</th>
                  <th className="py-1.5 px-3 text-end font-medium">{t("reports.legend.created")}</th>
                  <th className="py-1.5 ps-3 text-end font-medium">{t("reports.legend.resolved")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.byPriority.map((row) => (
                  <tr key={row.priority}>
                    <td className="py-1.5 pe-3">
                      <TicketPriorityText priority={row.priority} />
                    </td>
                    <td className="py-1.5 px-3 text-end tabular-nums text-foreground">
                      {nf.format(row.created)}
                    </td>
                    <td className="py-1.5 ps-3 text-end tabular-nums text-foreground">
                      {nf.format(row.resolved)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:border-s md:border-border md:ps-6">
            <h3 className="text-sm font-semibold text-foreground">{t("reports.byCategory")}</h3>
            {data.byCategory.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("reports.emptyStatus")}</p>
            ) : (
              <div className="max-h-[220px] overflow-y-auto">
                <table className="mt-3 w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-1.5 pe-3 text-start font-medium">{t("tickets.category")}</th>
                      <th className="py-1.5 ps-3 text-end font-medium">{t("reports.legend.created")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.byCategory.map((row) => (
                      <tr key={row.categoryId ?? "uncategorized"}>
                        <td className="py-1.5 pe-3">
                          <span
                            className="line-clamp-1 break-words font-medium text-foreground"
                            title={row.categoryName ?? t("reports.uncategorized")}
                          >
                            {row.categoryName ?? t("reports.uncategorized")}
                          </span>
                        </td>
                        <td className="py-1.5 ps-3 text-end tabular-nums text-foreground">
                          {nf.format(row.created)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </ReportPanel>
  );
}
