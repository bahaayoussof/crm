import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAgentReports } from "../reports-hooks";
import { useReportsRangeParams } from "../hooks/use-reports-range-params";
import { ReportSection } from "../components/report-primitives";
import { AgentPerformanceDataTable } from "../components/agent-performance-datatable";
import type { AgentSortBy } from "../reports.types";

const DEFAULT_PAGE_SIZE = 15;

export function ReportsAgentsPage() {
  const { t } = useTranslation();
  const { rangeParams } = useReportsRangeParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE);
  const sortBy = (searchParams.get("sortBy") as AgentSortBy) || undefined;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || undefined;

  const queryParams = useMemo(
    () => ({
      ...rangeParams,
      search: search || undefined,
      page,
      limit,
      sortBy,
      sortOrder,
    }),
    [rangeParams, search, page, limit, sortBy, sortOrder]
  );

  const agentsQuery = useAgentReports(queryParams);

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
          // Reset page to 1 on search
          next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const onSortChange = useCallback(
    (column: AgentSortBy) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (sortBy === column) {
            // toggle asc / desc
            if (sortOrder === "asc") {
              next.set("sortOrder", "desc");
            } else {
              next.set("sortOrder", "asc");
            }
          } else {
            next.set("sortBy", column);
            // Default asc for name, desc for metrics
            next.set("sortOrder", column === "name" ? "asc" : "desc");
          }
          // Reset page to 1 on sorting
          next.delete("page");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams, sortBy, sortOrder]
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

  const agentRows = agentsQuery.data?.agents ?? agentsQuery.data?.data ?? [];
  const pagination = agentsQuery.data?.pagination;
  const totalCount = pagination?.total ?? agentsQuery.data?.total ?? agentRows.length;
  const pageCount = pagination?.totalPages ?? agentsQuery.data?.totalPages ?? (Math.ceil(totalCount / limit) || 1);


  return (
    <div className="space-y-6">
      <ReportSection
        title={t("reports.agentsTitle")}
        description={t("reports.agentsDescription")}
        labelledBy="reports-agents-heading"
      >
        <AgentPerformanceDataTable
          agents={agentRows}
          isLoading={agentsQuery.isLoading}
          isError={agentsQuery.isError}
          search={search}
          onSearchChange={onSearchChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          page={page}
          pageSize={limit}
          pageCount={pageCount}
          totalCount={totalCount}
          onPageChange={onPageChange}
          onRetry={() => agentsQuery.refetch()}
        />
      </ReportSection>
    </div>
  );
}
