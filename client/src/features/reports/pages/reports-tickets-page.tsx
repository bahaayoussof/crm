import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTicketReports } from "../reports-hooks";
import { useReportsRangeParams } from "../hooks/use-reports-range-params";
import { ReportSection, InlineState } from "../components/report-primitives";
import { ChartSkeleton } from "@/components/shared/charts";
import {
  DIMENSION_CONFIGS,
  normalizeBreakdownItems,
} from "../components/ticket-breakdown/breakdown-config";
import { BreakdownChart } from "../components/ticket-breakdown/breakdown-chart";
import { BreakdownTable } from "../components/ticket-breakdown/breakdown-table";

export function ReportsTicketsPage() {
  const { t } = useTranslation();
  const { rangeParams } = useReportsRangeParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeView = useMemo<"overview" | "categories">(() => {
    return searchParams.get("view") === "categories" || searchParams.get("dimension") === "category"
      ? "categories"
      : "overview";
  }, [searchParams]);

  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const ticketsQuery = useTicketReports(rangeParams);

  const onViewChange = useCallback(
    (view: "overview" | "categories") => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("dimension");
          if (view === "overview") {
            next.delete("view");
          } else {
            next.set("view", view);
          }
          // Reset page-scoped search and page
          next.delete("search");
          next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const onSearchChange = useCallback(
    (newSearch: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newSearch.trim()) {
            next.set("search", newSearch);
          } else {
            next.delete("search");
          }
          next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const onPageChange = useCallback(
    (newPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (newPage > 1) {
            next.set("page", String(newPage));
          } else {
            next.delete("page");
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const breakdownItems = useMemo(() => {
    if (!ticketsQuery.data) {
      return { status: [], priority: [], category: [], channel: [] };
    }
    return {
      status: normalizeBreakdownItems("status", ticketsQuery.data, t),
      priority: normalizeBreakdownItems("priority", ticketsQuery.data, t),
      category: normalizeBreakdownItems("category", ticketsQuery.data, t),
      channel: normalizeBreakdownItems("channel", ticketsQuery.data, t),
    };
  }, [ticketsQuery.data, t]);

  const visibleCategoryItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? breakdownItems.category.filter((item) =>
          (item.label ?? item.key).toLowerCase().includes(query)
        )
      : breakdownItems.category;
    const start = (page - 1) * 10;
    return filtered.slice(start, start + 10);
  }, [breakdownItems.category, page, search]);

  if (ticketsQuery.isLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <div className="h-10 w-80 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartSkeleton height={340} />
          <div className="h-80 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <InlineState text={t("reports.loadError")}>
        <button
          type="button"
          className="button-secondary"
          onClick={() => ticketsQuery.refetch()}
        >
          {t("common.retry")}
        </button>
      </InlineState>
    );
  }

  return (
    <div className="space-y-6">
      <ReportSection
        title={t("reports.breakdownTitle")}
        description={t("reports.description")}
        labelledBy="reports-tickets-heading"
      >
        <div
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface-subtle p-1"
          role="tablist"
          aria-label={t("reports.breakdownTitle")}
        >
          {(["overview", "categories"] as const).map((view) => {
            const isActive = activeView === view;

            return (
              <button
                key={view}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onViewChange(view)}
                className={cn(
                  "min-h-8 shrink-0 rounded-md px-3.5 text-xs font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-surface text-foreground font-semibold shadow-subtle ring-1 ring-border"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                )}
              >
                {t(`reports.breakdown.${view}`)}
              </button>
            );
          })}
        </div>

        {activeView === "overview" ? (
          <div data-testid="breakdown-overview" className="grid items-stretch gap-5 md:grid-cols-2">
            <BreakdownChart
              items={breakdownItems.status}
              config={DIMENSION_CONFIGS.status}
              className="h-full"
            />
            <BreakdownChart
              items={breakdownItems.channel}
              config={DIMENSION_CONFIGS.channel}
              className="h-full"
            />
            <BreakdownChart
              items={breakdownItems.priority}
              config={DIMENSION_CONFIGS.priority}
              className="md:col-span-2"
            />
          </div>
        ) : (
          <div data-testid="breakdown-categories" className="min-w-0 space-y-5">
            <BreakdownChart items={visibleCategoryItems} config={DIMENSION_CONFIGS.category} />
            <BreakdownTable
              items={breakdownItems.category}
              config={DIMENSION_CONFIGS.category}
              search={search}
              onSearchChange={onSearchChange}
              page={page}
              pageSize={10}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </ReportSection>
    </div>
  );
}
