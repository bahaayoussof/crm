import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  DataTable,
  DataTableToolbar,
  DataTableSearch,
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

const COLUMN_WIDTHS: Record<string, string> = {
  name: "w-[30%]",
  assigned: "w-[14%]",
  resolved: "w-[14%]",
  open: "w-[14%]",
  slaMet: "w-[14%]",
  avgResponse: "w-[14%]",
};

const NUMERIC_CELL = "text-end tabular-nums text-[12px] text-table-foreground";
const COLUMN_CLASSES: Record<string, string> = {
  name: "text-start",
  assigned: NUMERIC_CELL,
  resolved: NUMERIC_CELL,
  open: NUMERIC_CELL,
  slaMet: "text-end tabular-nums text-[12px]",
  avgResponse: NUMERIC_CELL,
};

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
  const emptyMessage = hasSearch
    ? t("reports.emptyAgentsMatch", {
        defaultValue: "No agents match “{{search}}”.",
        search,
      })
    : t("reports.emptyAgents", {
        defaultValue: "No agent performance data found.",
      });

  const columns = useMemo<ColumnDef<AgentReportRow>[]>(
    () => [
      {
        id: "name",
        header: () => (
          <SortHeader
            column="name"
            currentSortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            align="start"
          >
            {t("reports.agents.name")}
          </SortHeader>
        ),
        cell: ({ row }) => (
          <AssigneeCell name={row.original.agentName} unassignedLabel={t("tickets.unassigned")} />
        ),
      },
      {
        id: "assigned",
        header: () => (
          <SortHeader column="assigned" currentSortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="end">
            {t("reports.agents.assigned")}
          </SortHeader>
        ),
        cell: ({ row }) => nf.format(row.original.assigned),
      },
      {
        id: "resolved",
        header: () => (
          <SortHeader column="resolved" currentSortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="end">
            {t("reports.agents.resolved")}
          </SortHeader>
        ),
        cell: ({ row }) => nf.format(row.original.resolved),
      },
      {
        id: "open",
        header: () => (
          <SortHeader column="open" currentSortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="end">
            {t("reports.agents.open")}
          </SortHeader>
        ),
        cell: ({ row }) => nf.format(row.original.open),
      },
      {
        id: "slaMet",
        header: () => (
          <SortHeader column="slaMetPercentage" currentSortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="end">
            {t("reports.agents.slaMet")}
          </SortHeader>
        ),
        cell: ({ row }) =>
          row.original.slaMetPct === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                "font-medium",
                row.original.slaMetPct >= 90
                  ? "text-success-foreground"
                  : row.original.slaMetPct >= 70
                  ? "text-warning-foreground"
                  : "text-danger-foreground"
              )}
            >
              {nf.format(row.original.slaMetPct)}%
            </span>
          ),
      },
      {
        id: "avgResponse",
        header: () => (
          <SortHeader column="avgFirstResponse" currentSortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="end">
            {t("reports.agents.avgResponse")}
          </SortHeader>
        ),
        cell: ({ row }) => <Duration minutes={row.original.averageFirstResponseMinutes} />,
      },
    ],
    [nf, onSortChange, sortBy, sortOrder, t]
  );

  return (
    <DataTable
      data={agents}
      columns={columns}
      getRowId={(agent) => agent.agentId}
      columnWidths={COLUMN_WIDTHS}
      columnClasses={COLUMN_CLASSES}
      minWidth="min-w-[50rem]"
      isLoading={isLoading}
      loadingRowCount={pageSize > 0 ? Math.min(pageSize, 8) : 5}
      isError={isError}
      errorState={
        <div className="text-center text-muted-foreground">
          <p className="text-xs">{t("reports.loadError")}</p>
          <button type="button" className="button-secondary text-xs mt-3" onClick={onRetry}>
            {t("common.retry")}
          </button>
        </div>
      }
      emptyMessage={emptyMessage}
      toolbar={
        <DataTableToolbar>
          <DataTableSearch
            value={search}
            onChange={onSearchChange}
            placeholder={t("reports.agents.searchPlaceholder", { defaultValue: "Search agents…" })}
            id="agent-performance-search"
            ariaLabel={t("reports.agents.searchPlaceholder", { defaultValue: "Search agents…" })}
          />
        </DataTableToolbar>
      }
      pagination={{
        page,
        pageSize,
        pageCount,
        totalCount,
        onPageChange,
        alwaysShow: totalCount > 0,
      }}
      renderMobileCard={(agent) => (
        <div className="p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <AssigneeCell name={agent.agentName} unassignedLabel={t("tickets.unassigned")} />
            {agent.slaMetPct !== null ? (
              <Badge
                size="sm"
                variant={
                  agent.slaMetPct >= 90 ? "success" : agent.slaMetPct >= 70 ? "warning" : "danger"
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
      )}
    />
  );
}
