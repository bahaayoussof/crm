import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
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
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useManagerTeam } from "./manager-hooks";
import { formatDurationMinutes } from "./manager-format";
import type { TeamSortBy } from "./manager.types";

const PAGE_SIZE = 20;
const SORTABLE: TeamSortBy[] = [
  "name",
  "openAssigned",
  "inProgress",
  "waitingCustomer",
  "resolved",
  "slaCompliance",
  "avgFirstResponse",
  "avgResolution",
];

interface SortHeaderProps {
  column: TeamSortBy;
  currentSortBy?: TeamSortBy;
  sortOrder?: "asc" | "desc";
  onSortChange: (column: TeamSortBy) => void;
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

function SlaValue({ pct, nf }: { pct: number | null; nf: Intl.NumberFormat }) {
  if (pct === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "font-medium",
        pct >= 90
          ? "text-success-foreground"
          : pct >= 70
          ? "text-warning-foreground"
          : "text-danger-foreground"
      )}
    >
      {nf.format(Math.round(pct))}%
    </span>
  );
}

export function ManagerTeamPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();

  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language]
  );

  const search = params.get("search") ?? "";
  const debounced = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const sortBy = (SORTABLE.includes(params.get("sortBy") as TeamSortBy) ? params.get("sortBy") : undefined) as
    | TeamSortBy
    | undefined;
  const sortOrder: "asc" | "desc" = params.get("sortOrder") === "asc" ? "asc" : "desc";

  const query = useMemo(
    () => ({ search: debounced || undefined, page, limit: PAGE_SIZE, sortBy, sortOrder }),
    [debounced, page, sortBy, sortOrder],
  );
  const team = useManagerTeam(query);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const onSort = (column: TeamSortBy) => {
    const next = new URLSearchParams(params);
    if (sortBy === column) {
      next.set("sortOrder", sortOrder === "asc" ? "desc" : "asc");
    } else {
      next.set("sortBy", column);
      next.set("sortOrder", column === "name" ? "asc" : "desc");
    }
    next.delete("page");
    setParams(next, { replace: true });
  };

  const rows = team.data?.data ?? [];
  const pagination = team.data?.pagination;
  const totalCount = pagination?.total ?? rows.length;
  const pageCount = pagination?.totalPages ?? 1;
  const emptyMessage = t("manager.team.empty");

  const metricHeaders: Array<{ key: TeamSortBy }> = [
    { key: "openAssigned" },
    { key: "inProgress" },
    { key: "waitingCustomer" },
    { key: "resolved" },
    { key: "slaCompliance" },
    { key: "avgFirstResponse" },
    { key: "avgResolution" },
  ];

  const teamName = team.data?.meta.teamName ?? null;

  return (
    <main className="page-container space-y-5">
      <PageHeader
        title={t("manager.team.title")}
        description={teamName ? `${t("manager.teamContext")}: ${teamName}` : t("manager.team.subtitle")}
      />

      <DataTableSurface>
        <DataTableToolbar>
          <DataTableSearch
            id="team-search"
            ariaLabel={t("manager.team.search")}
            value={search}
            onChange={(value) => setParam("search", value)}
            placeholder={t("manager.team.search")}
          />
        </DataTableToolbar>

        {team.isLoading ? (
          <div className="p-4" aria-label={t("common.loading")}>
            <DataTableSkeleton columns={8} rowCount={Math.min(PAGE_SIZE, 8)} />
          </div>
        ) : team.isError ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-xs">{t("manager.team.loadError")}</p>
            <button type="button" className="button-secondary text-xs mt-3" onClick={() => team.refetch()}>
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop / tablet table */}
            <div className="hidden md:block overflow-x-auto">
              <Table className="min-w-[56rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24%] text-start">
                      <SortHeader
                        column="name"
                        currentSortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={onSort}
                        align="start"
                      >
                        {t("manager.team.name")}
                      </SortHeader>
                    </TableHead>
                    {metricHeaders.map((header) => (
                      <TableHead key={header.key} className="text-end">
                        <SortHeader
                          column={header.key}
                          currentSortBy={sortBy}
                          sortOrder={sortOrder}
                          onSortChange={onSort}
                          align="end"
                        >
                          {t(`manager.team.${header.key}`)}
                        </SortHeader>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <DataTableEmptyRow colSpan={8} message={emptyMessage} />
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.agentId}>
                        <TableCell className="text-start">
                          <Link
                            to={`/manager/team/${row.agentId}`}
                            className="inline-flex rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <AssigneeCell name={row.agentName} unassignedLabel={t("tickets.unassigned")} />
                          </Link>
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                          {nf.format(row.openAssigned)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                          {nf.format(row.inProgress)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                          {nf.format(row.waitingCustomer)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-muted-foreground">
                          {nf.format(row.resolved)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px]">
                          <SlaValue pct={row.slaCompliancePct} nf={nf} />
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                          {formatDurationMinutes(row.avgFirstResponseMinutes)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums text-[12px] text-table-foreground">
                          {formatDurationMinutes(row.avgResolutionMinutes)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-border-subtle bg-table-background md:hidden">
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">{emptyMessage}</p>
              ) : (
                rows.map((row) => (
                  <div key={row.agentId} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/manager/team/${row.agentId}`}
                        className="inline-flex min-w-0 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <AssigneeCell name={row.agentName} unassignedLabel={t("tickets.unassigned")} />
                      </Link>
                      {row.slaCompliancePct !== null ? (
                        <Badge
                          size="sm"
                          variant={
                            row.slaCompliancePct >= 90
                              ? "success"
                              : row.slaCompliancePct >= 70
                              ? "warning"
                              : "danger"
                          }
                        >
                          {`${nf.format(Math.round(row.slaCompliancePct))}% SLA`}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-border-subtle">
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.openAssigned")}: </span>
                        <span className="font-medium text-foreground tabular-nums">{nf.format(row.openAssigned)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.inProgress")}: </span>
                        <span className="font-medium text-foreground tabular-nums">{nf.format(row.inProgress)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.waitingCustomer")}: </span>
                        <span className="font-medium text-foreground tabular-nums">{nf.format(row.waitingCustomer)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.resolved")}: </span>
                        <span className="font-medium text-foreground tabular-nums">{nf.format(row.resolved)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.avgFirstResponse")}: </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatDurationMinutes(row.avgFirstResponseMinutes)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t("manager.team.avgResolution")}: </span>
                        <span className="font-medium text-foreground tabular-nums">
                          {formatDurationMinutes(row.avgResolutionMinutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {!team.isLoading && !team.isError && totalCount > 0 && (
          <div className="border-t border-table-border bg-table-background px-3.5 py-2">
            <DataTablePagination
              page={page}
              pageSize={PAGE_SIZE}
              pageCount={pageCount}
              totalCount={totalCount}
              canPreviousPage={page > 1}
              canNextPage={page < pageCount}
              onPreviousPage={() => setParam("page", String(Math.max(1, page - 1)))}
              onNextPage={() => setParam("page", String(page + 1))}
              ariaLabel={t("manager.team.title")}
            />
          </div>
        )}
      </DataTableSurface>
    </main>
  );
}
