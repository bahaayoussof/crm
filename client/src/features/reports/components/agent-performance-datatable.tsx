import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTablePagination,
  DataTableSkeleton,
  DataTableEmptyRow,
  AssigneeCell,
} from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentReportRow, AgentSortBy } from "../reports.types";
import { Duration } from "./duration";

export interface AgentPerformanceDataTableProps {
  agents: AgentReportRow[];
  isLoading?: boolean;
  isError?: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  sortBy?: AgentSortBy;
  sortOrder?: "asc" | "desc";
  onSortChange: (column: AgentSortBy) => void;
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}

interface SortHeaderProps {
  column: AgentSortBy;
  currentSortBy?: AgentSortBy;
  sortOrder?: "asc" | "desc";
  onSortChange: (column: AgentSortBy) => void;
  children: React.ReactNode;
  align?: "start" | "end";
}

function SortHeader({
  column,
  currentSortBy,
  sortOrder,
  onSortChange,
  children,
  align = "start",
}: SortHeaderProps) {
  const isActive = currentSortBy === column;

  return (
    <button
      type="button"
      onClick={() => onSortChange(column)}
      className={cn(
        "group inline-flex items-center gap-1.5 font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm select-none",
        align === "end" && "ms-auto",
        isActive ? "text-foreground font-semibold" : "text-table-header-foreground"
      )}
    >
      <span>{children}</span>
      {isActive ? (
        sortOrder === "asc" ? (
          <ArrowUp className="size-3 text-primary shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDown className="size-3 text-primary shrink-0" aria-hidden="true" />
        )
      ) : (
        <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}

export function AgentPerformanceDataTable({
  agents,
  isLoading,
  isError,
  search,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  page,
  pageSize,
  pageCount,
  totalCount,
  onPageChange,
  onRetry,
}: AgentPerformanceDataTableProps) {
  const { t, i18n } = useTranslation();

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language]
  );

  const hasSearch = search.trim().length > 0;

  return (
    <DataTableSurface>
      {/* 1. Shared Compact Search Toolbar */}
      <DataTableToolbar>
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={t("reports.agents.searchPlaceholder", { defaultValue: "Search agents…" })}
          id="agent-performance-search"
          ariaLabel={t("reports.agents.searchPlaceholder", { defaultValue: "Search agents…" })}
        />
      </DataTableToolbar>

      {/* 2. Loading State */}
      {isLoading ? (
        <div className="p-4">
          <DataTableSkeleton columns={6} rowCount={pageSize > 0 ? Math.min(pageSize, 8) : 5} />
        </div>
      ) : isError ? (
        /* Error State */
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-xs">{t("reports.loadError")}</p>
          <button type="button" className="button-secondary text-xs mt-3" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          {/* 3. Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table className="min-w-[50rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%] text-start">
                    <SortHeader
                      column="name"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="start"
                    >
                      {t("reports.agents.name")}
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[14%] text-end">
                    <SortHeader
                      column="assigned"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="end"
                    >
                      {t("reports.agents.assigned")}
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[14%] text-end">
                    <SortHeader
                      column="resolved"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="end"
                    >
                      {t("reports.agents.resolved")}
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[14%] text-end">
                    <SortHeader
                      column="open"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="end"
                    >
                      {t("reports.agents.open")}
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[14%] text-end">
                    <SortHeader
                      column="slaMetPercentage"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="end"
                    >
                      {t("reports.agents.slaMet")}
                    </SortHeader>
                  </TableHead>
                  <TableHead className="w-[14%] text-end">
                    <SortHeader
                      column="avgFirstResponse"
                      currentSortBy={sortBy}
                      sortOrder={sortOrder}
                      onSortChange={onSortChange}
                      align="end"
                    >
                      {t("reports.agents.avgResponse")}
                    </SortHeader>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <DataTableEmptyRow
                    colSpan={6}
                    message={
                      hasSearch
                        ? t("reports.emptyAgentsMatch", {
                            defaultValue: "No agents match “{{search}}”.",
                            search,
                          })
                        : t("reports.emptyAgents", {
                            defaultValue: "No agent performance data found.",
                          })
                    }
                  />
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.agentId}>
                      {/* Agent column using shared AssigneeCell */}
                      <TableCell className="text-start">
                        <AssigneeCell
                          name={agent.agentName}
                          unassignedLabel={t("tickets.unassigned")}
                        />
                      </TableCell>

                      {/* Numeric columns matching standard CRM table typography */}
                      <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                        {nf.format(agent.assigned)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                        {nf.format(agent.resolved)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                        {nf.format(agent.open)}
                      </TableCell>

                      {/* SLA Met % with subtle semantic styling */}
                      <TableCell className="text-end tabular-nums text-[12px]">
                        {agent.slaMetPct === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-medium",
                              agent.slaMetPct >= 90
                                ? "text-success-foreground"
                                : agent.slaMetPct >= 70
                                ? "text-warning-foreground"
                                : "text-danger-foreground"
                            )}
                          >
                            {nf.format(agent.slaMetPct)}%
                          </span>
                        )}
                      </TableCell>

                      {/* Avg Response Duration */}
                      <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                        <Duration minutes={agent.averageFirstResponseMinutes} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 4. Mobile Card View */}
          <div className="divide-y divide-border-subtle bg-table-background md:hidden">
            {agents.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                {hasSearch
                  ? t("reports.emptyAgentsMatch", {
                      defaultValue: "No agents match “{{search}}”.",
                      search,
                    })
                  : t("reports.emptyAgents", {
                      defaultValue: "No agent performance data found.",
                    })}
              </p>
            ) : (
              agents.map((agent) => (
                <div key={agent.agentId} className="p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <AssigneeCell
                      name={agent.agentName}
                      unassignedLabel={t("tickets.unassigned")}
                    />
                    {agent.slaMetPct !== null ? (
                      <Badge
                        size="sm"
                        variant={
                          agent.slaMetPct >= 90
                            ? "success"
                            : agent.slaMetPct >= 70
                            ? "warning"
                            : "danger"
                        }
                      >
                        {`${nf.format(agent.slaMetPct)}% SLA`}
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-border-subtle">
                    <div>
                      <span className="text-muted-foreground">{t("reports.agents.assigned")}: </span>
                      <span className="font-medium text-foreground tabular-nums">{nf.format(agent.assigned)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("reports.agents.resolved")}: </span>
                      <span className="font-medium text-foreground tabular-nums">{nf.format(agent.resolved)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("reports.agents.open")}: </span>
                      <span className="font-medium text-foreground tabular-nums">{nf.format(agent.open)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t("reports.agents.avgResponse")}: </span>
                      <span className="font-medium text-foreground tabular-nums">
                        <Duration minutes={agent.averageFirstResponseMinutes} />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 5. Shared Standard DataTable Pagination Footer */}
      {!isLoading && !isError && totalCount > 0 && (
        <div className="border-t border-table-border bg-table-background px-3.5 py-2">
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            totalCount={totalCount}
            canPreviousPage={page > 1}
            canNextPage={page < pageCount}
            onPreviousPage={() => onPageChange(page - 1)}
            onNextPage={() => onPageChange(page + 1)}
          />
        </div>
      )}
    </DataTableSurface>
  );
}
