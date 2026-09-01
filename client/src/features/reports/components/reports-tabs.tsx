import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { createReportNavTarget } from "../hooks/use-reports-range-params";

export interface ReportTabItem {
  key: string;
  to: string;
  labelKey: string;
  end?: boolean;
}

export const REPORT_TABS: readonly ReportTabItem[] = [
  { key: "overview", to: "/reports", labelKey: "navigation.reportsOverview", end: true },
  { key: "sla", to: "/reports/sla", labelKey: "navigation.reportsSla" },
  { key: "agents", to: "/reports/agents", labelKey: "navigation.reportsAgents" },
  { key: "tickets", to: "/reports/tickets", labelKey: "navigation.reportsTickets" },
] as const;

export function ReportsTabs({ className }: { className?: string }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const tabTargets = useMemo(() => {
    return REPORT_TABS.map((tab) => ({
      ...tab,
      target: createReportNavTarget(tab.to, searchParams),
    }));
  }, [searchParams]);

  return (
    <nav
      aria-label={t("reports.title")}
      className={cn("flex w-full overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", className)}
    >
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-surface-subtle p-1 text-muted-foreground whitespace-nowrap"
      >
        {tabTargets.map((tab) => {
          const isExact = tab.end;
          const isActive = isExact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to);

          return (
            <NavLink
              key={tab.key}
              to={tab.target}
              end={tab.end}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={({ isActive: active }) =>
                cn(
                  "inline-flex items-center justify-center rounded-md px-3.5 py-1.5 text-xs font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  active
                    ? "bg-card text-foreground shadow-subtle font-semibold"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                )
              }
            >
              {t(tab.labelKey)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
