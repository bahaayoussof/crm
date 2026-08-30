import * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ChevronRight,
  Eye,
  Globe,
  Monitor,
  Server,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  DataTable,
  DataTableSearch,
  DataTableSurface,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AppSelect } from "@/components/ui/app-select";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/date-picker/date-range-picker";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatDisplayRange,
  localeTag,
  startOfDay,
} from "@/components/date-picker/date-picker-utils";
import { useAgents } from "@/features/tickets/ticket-hooks";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useAuditLogs } from "./audit-log-hooks";
import type { AuditChange, AuditLog, AuditLogFilters } from "./audit-log.types";

const ACTIONS = [
  "USER_CREATED",
  "USER_UPDATED",
  "USER_ROLE_CHANGED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "CUSTOMER_CREATED",
  "CUSTOMER_UPDATED",
  "CUSTOMER_DELETED",
  "CUSTOMER_NOTE_ADDED",
  "TICKET_CREATED",
  "TICKET_STATUS_CHANGED",
  "TICKET_PRIORITY_CHANGED",
  "TICKET_CATEGORY_CHANGED",
  "TICKET_ASSIGNED",
  "TICKET_ESCALATED",
  "TICKET_CLOSED",
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "SLA_RULE_CREATED",
  "SLA_RULE_UPDATED",
] as const;

const ENTITIES = [
  "USER",
  "CUSTOMER",
  "TICKET",
  "CATEGORY",
  "SLA_RULE",
] as const;

function formatDiffValue(input: unknown): string {
  if (input === null || input === undefined || input === "") return "—";
  if (typeof input === "boolean") return input ? "true" : "false";
  return String(input);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatPropertyLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function getActionBadgeVariant(action: string): "neutral" | "danger" | "warning" | "success" | "info" {
  if (
    action === "USER_DEACTIVATED" ||
    action === "CUSTOMER_DELETED" ||
    action === "TICKET_CLOSED"
  ) {
    return "danger";
  }
  if (action === "TICKET_ESCALATED") {
    return "warning";
  }
  if (
    action === "USER_CREATED" ||
    action === "USER_ACTIVATED" ||
    action === "CUSTOMER_CREATED" ||
    action === "TICKET_CREATED" ||
    action === "CATEGORY_CREATED" ||
    action === "SLA_RULE_CREATED"
  ) {
    return "success";
  }
  return "neutral";
}

function ChangeSummary({
  changes,
  onViewDetails,
}: {
  changes: Record<string, AuditChange>;
  onViewDetails?: () => void;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(changes);
  if (!entries.length) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const [firstKey, firstItem] = entries[0];
  const remainingCount = Math.max(entries.length - 1, 0);

  return (
    <div className="max-w-full space-y-0.5 text-xs">
      <div className="min-w-0 flex flex-col">
        <span className="font-medium text-foreground text-[11px] capitalize truncate">
          {formatPropertyLabel(firstKey)}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
          <span
            className="truncate max-w-28 text-muted-foreground/80 line-through decoration-muted-foreground/40 font-mono text-[11px]"
            title={firstItem.from != null ? String(firstItem.from) : ""}
          >
            <bdi>{formatDiffValue(firstItem.from)}</bdi>
          </span>
          <span className="inline-block shrink-0 text-muted-foreground/60 rtl:rotate-180" aria-hidden="true">
            →
          </span>
          <span
            className="truncate max-w-32 font-medium text-foreground font-mono text-[11px]"
            title={firstItem.to != null ? String(firstItem.to) : ""}
          >
            <bdi>{formatDiffValue(firstItem.to)}</bdi>
          </span>
        </div>
      </div>
      {remainingCount > 0 && (
        <button
          type="button"
          onClick={onViewDetails}
          className="text-[11px] font-medium text-muted-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded text-start block mt-0.5"
        >
          {t("auditLogs.moreChanges", { count: remainingCount })}
        </button>
      )}
    </div>
  );
}

export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const mobileFilterTrigger = useRef<HTMLButtonElement | null>(null);

  const search = params.get("search") ?? "";
  const debounced = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const action = params.get("action") ?? "";
  const entityType = params.get("entityType") ?? "";
  const actorId = params.get("actorId") ?? "";
  const fromParam = params.get("from") ?? "";
  const toParam = params.get("to") ?? "";

  const activeFiltersCount = useMemo(
    () =>
      [
        Boolean(action),
        Boolean(entityType),
        Boolean(actorId),
        Boolean(fromParam || toParam),
      ].filter(Boolean).length,
    [action, entityType, actorId, fromParam, toParam]
  );

  const dateRangeValue = useMemo<DateRange>(() => {
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    return {
      from: from && !isNaN(from.getTime()) ? from : undefined,
      to: to && !isNaN(to.getTime()) ? to : undefined,
    };
  }, [fromParam, toParam]);

  const agentsQuery = useAgents();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      setParams(next, { replace: key === "search" });
    },
    [params, setParams]
  );

  const setDateRange = useCallback(
    (range: DateRange) => {
      const next = new URLSearchParams(params);
      if (range.from) {
        next.set("from", startOfDay(range.from).toISOString());
      } else {
        next.delete("from");
      }
      if (range.to) {
        const end = new Date(
          range.to.getFullYear(),
          range.to.getMonth(),
          range.to.getDate(),
          23,
          59,
          59,
          999
        );
        next.set("to", end.toISOString());
      } else {
        next.delete("to");
      }
      next.delete("page");
      setParams(next);
    },
    [params, setParams]
  );

  const clearAllFilters = useCallback(() => {
    setParams({});
  }, [setParams]);

  const filters: AuditLogFilters = useMemo(
    () => ({
      page,
      limit: 15,
      ...(debounced ? { search: debounced } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
      ...(fromParam ? { from: fromParam } : {}),
      ...(toParam ? { to: toParam } : {}),
    }),
    [page, debounced, action, entityType, actorId, fromParam, toParam]
  );

  const query = useAuditLogs(filters);

  const hasFilters = Boolean(
    debounced || action || entityType || actorId || fromParam || toParam
  );

  const label = useCallback(
    (prefix: string, raw: string) =>
      t(`${prefix}.${raw}`, {
        defaultValue: raw.replaceAll("_", " ").toLowerCase(),
      }),
    [t]
  );

  const actionOptions = useMemo(
    () => [
      { value: "", label: t("auditLogs.filters.allActions") },
      ...ACTIONS.map((item) => ({
        value: item,
        label: label("auditLogs.actions", item),
      })),
    ],
    [label, t]
  );

  const entityOptions = useMemo(
    () => [
      { value: "", label: t("auditLogs.filters.allEntities") },
      ...ENTITIES.map((item) => ({
        value: item,
        label: label("auditLogs.entityTypes", item),
      })),
    ],
    [label, t]
  );

  const actorOptions = useMemo(
    () => [
      { value: "", label: t("auditLogs.filters.allActors") },
      ...(agentsQuery.data?.map((user) => ({
        value: user.id,
        label: user.name,
        searchText: `${user.name} ${user.email}`,
      })) ?? []),
    ],
    [agentsQuery.data, t]
  );

  const selectedActorName = useMemo(() => {
    if (!actorId) return "";
    const found = agentsQuery.data?.find((u) => u.id === actorId);
    return found ? found.name : actorId;
  }, [actorId, agentsQuery.data]);

  const columns = useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        id: "time",
        header: () => (
          <span className="text-xs font-semibold">{t("auditLogs.time")}</span>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col text-xs leading-tight">
            <span className="font-medium text-foreground whitespace-nowrap">
              {formatDisplayDate(
                new Date(row.original.createdAt),
                i18n.language
              )}
            </span>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
              <bdi dir="ltr">
                {new Intl.DateTimeFormat(localeTag(i18n.language), {
                  timeStyle: "short",
                }).format(new Date(row.original.createdAt))}
              </bdi>
            </span>
          </div>
        ),
      },
      {
        id: "actor",
        header: () => (
          <span className="text-xs font-semibold">{t("auditLogs.actor")}</span>
        ),
        cell: ({ row }) =>
          row.original.actor ? (
            <div className="flex items-center gap-2 min-w-0 max-w-44">
              <span
                className="size-6 shrink-0 rounded-full bg-surface-secondary text-[10px] font-semibold text-foreground flex items-center justify-center border border-border/80 shadow-2xs"
                aria-hidden="true"
              >
                {getInitials(row.original.actor.name)}
              </span>
              <div className="min-w-0 leading-tight">
                <p
                  className="truncate text-xs font-medium text-foreground"
                  title={row.original.actor.name}
                >
                  {row.original.actor.name}
                </p>
                <p
                  className="truncate text-[10px] text-muted-foreground"
                  title={row.original.actor.email}
                >
                  <bdi dir="ltr">{row.original.actor.email}</bdi>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
              <span
                className="size-6 shrink-0 rounded-full border border-dashed border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center"
                aria-hidden="true"
              >
                <Server
                  className="size-3 text-muted-foreground/70"
                  aria-hidden="true"
                />
              </span>
              <span className="font-medium text-muted-foreground">
                {t("auditLogs.systemActor")}
              </span>
            </div>
          ),
      },
      {
        id: "action",
        header: () => (
          <span className="text-xs font-semibold">{t("auditLogs.action")}</span>
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <Badge
              variant={getActionBadgeVariant(row.original.action)}
              size="default"
              className="text-[11px] font-medium max-w-full truncate"
            >
              {label("auditLogs.actions", row.original.action)}
            </Badge>
          </div>
        ),
      },
      {
        id: "entity",
        header: () => (
          <span className="text-xs font-semibold">{t("auditLogs.entity")}</span>
        ),
        cell: ({ row }) => (
          <div className="min-w-0 leading-tight space-y-0.5">
            <span className="text-xs font-medium text-foreground block truncate">
              {label("auditLogs.entityTypes", row.original.entityType)}
            </span>
            {row.original.entityId && (
              <bdi
                dir="ltr"
                className="block max-w-full truncate font-mono text-[10px] text-muted-foreground"
                title={row.original.entityId}
              >
                #{row.original.entityId}
              </bdi>
            )}
          </div>
        ),
      },
      {
        id: "changes",
        header: () => (
          <span className="text-xs font-semibold">
            {t("auditLogs.changes")}
          </span>
        ),
        cell: ({ row }) => (
          <ChangeSummary
            changes={row.original.changes}
            onViewDetails={() => {
              detailTrigger.current = document.activeElement as HTMLButtonElement;
              setSelected(row.original);
            }}
          />
        ),
      },
      {
        id: "details",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <button
              ref={selected?.id === row.original.id ? detailTrigger : undefined}
              type="button"
              className="inline-flex size-8.5 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("auditLogs.viewDetails")}
              title={t("auditLogs.viewDetails")}
              onClick={(event) => {
                detailTrigger.current = event.currentTarget;
                setSelected(row.original);
              }}
            >
              <Eye className="size-4.5" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ],
    [i18n.language, label, selected?.id, t]
  );

  return (
    <main className="page-container">
      <div className="space-y-5">
        <PageHeader
          title={t("auditLogs.title")}
          description={t("auditLogs.description")}
        />

        {/* Filters and Search Surface */}
        <DataTableSurface className="p-3.5 space-y-3">
          {/* Mobile Filter Track (<lg) */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            {/* Search Input: full width */}
            <DataTableSearch
              id="audit-search-mobile"
              ariaLabel={t("auditLogs.searchPlaceholder")}
              value={search}
              onChange={(val) => setFilter("search", val)}
              placeholder={t("auditLogs.searchPlaceholder")}
              containerClassName="w-full max-w-full shrink min-w-0"
              className="w-full min-w-0"
            />

            {/* Filter Drawer Trigger & Result Count */}
            <div className="flex items-center justify-between gap-2">
              <button
                ref={mobileFilterTrigger}
                type="button"
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-foreground hover:bg-surface-hover shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={t("common.filters", "Filters")}
              >
                <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
                <span>{t("common.filters", "Filters")}</span>
                {activeFiltersCount > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {query.data?.meta && (
                <span className="text-xs text-muted-foreground">
                  {t("auditLogs.resultsCount", { count: query.data.meta.total })}
                </span>
              )}
            </div>
          </div>

          {/* Desktop Filter Grid (lg+) */}
          <div className="hidden lg:grid lg:grid-cols-12 lg:gap-2.5 lg:items-center">
            {/* Search (wider track) */}
            <div className="lg:col-span-4 min-w-0">
              <DataTableSearch
                id="audit-search"
                ariaLabel={t("auditLogs.searchPlaceholder")}
                value={search}
                onChange={(val) => setFilter("search", val)}
                placeholder={t("auditLogs.searchPlaceholder")}
                containerClassName="w-full max-w-full shrink min-w-0"
                className="w-full min-w-0"
              />
            </div>

            {/* Action Select */}
            <div className="lg:col-span-2">
              <AppSelect
                ariaLabel={t("auditLogs.filters.action")}
                value={action}
                onValueChange={(val) => setFilter("action", val)}
                options={actionOptions}
                searchable
              />
            </div>

            {/* Entity Type Select */}
            <div className="lg:col-span-2">
              <AppSelect
                ariaLabel={t("auditLogs.filters.entityType")}
                value={entityType}
                onValueChange={(val) => setFilter("entityType", val)}
                options={entityOptions}
              />
            </div>

            {/* Actor Select */}
            <div className="lg:col-span-2">
              <AppSelect
                ariaLabel={t("auditLogs.filters.actor")}
                value={actorId}
                onValueChange={(val) => setFilter("actorId", val)}
                options={actorOptions}
                searchable
              />
            </div>

            {/* Date Range Picker */}
            <div className="lg:col-span-2">
              <DateRangePicker
                value={dateRangeValue}
                onChange={setDateRange}
                placeholder={t("auditLogs.filters.dateRange")}
                ariaLabel={t("auditLogs.filters.dateRange")}
                presets
              />
            </div>
          </div>

          {/* Active Filter Chips */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/70 text-xs">
              <span className="text-muted-foreground font-medium me-1">
                {t("auditLogs.activeFilters")}:
              </span>

              {debounced && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                  <span>{t("auditLogs.filterChips.search", { value: debounced })}</span>
                  <button
                    type="button"
                    onClick={() => setFilter("search", "")}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Remove search filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {action && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                  <span>{t("auditLogs.filterChips.action", { value: label("auditLogs.actions", action) })}</span>
                  <button
                    type="button"
                    onClick={() => setFilter("action", "")}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Remove action filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {entityType && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                  <span>{t("auditLogs.filterChips.entity", { value: label("auditLogs.entityTypes", entityType) })}</span>
                  <button
                    type="button"
                    onClick={() => setFilter("entityType", "")}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Remove entity filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {actorId && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                  <span>{t("auditLogs.filterChips.actor", { value: selectedActorName })}</span>
                  <button
                    type="button"
                    onClick={() => setFilter("actorId", "")}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Remove actor filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {(fromParam || toParam) && (
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-foreground font-medium">
                  <span>
                    {t("auditLogs.filterChips.date", {
                      value:
                        formatDisplayRange(dateRangeValue, i18n.language) ??
                        t("auditLogs.filters.dateRange"),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDateRange({})}
                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                    aria-label="Remove date filter"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={clearAllFilters}
                className="text-primary hover:underline ms-auto text-xs font-medium"
              >
                {t("auditLogs.clearAll")}
              </button>
            </div>
          )}

          {/* Desktop Results Count (lg+) */}
          {query.data?.meta && (
            <div className="hidden lg:flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>
                {t("auditLogs.resultsCount", { count: query.data.meta.total })}
              </span>
            </div>
          )}
        </DataTableSurface>

        {/* Results Data Table */}
        <DataTable
          data={query.data?.data ?? []}
          columns={columns}
          getRowId={(row) => row.id}
          columnClasses={{
            time: "w-36 min-w-32",
            actor: "w-48 min-w-40",
            action: "w-44 min-w-36",
            entity: "w-52 min-w-44",
            changes: "min-w-64",
            details: "w-20 min-w-16 text-end",
          }}
          minWidth="min-w-full"
          isLoading={query.isLoading}
          isError={query.isError}
          errorState={
            <EmptyState
              title={t("auditLogs.loadError")}
              description={t("auditLogs.loadErrorDescription")}
              action={
                <button
                  type="button"
                  className="button-secondary text-xs"
                  onClick={() => query.refetch()}
                >
                  {t("common.retry")}
                </button>
              }
            />
          }
          emptyMessage={
            <EmptyState
              title={hasFilters ? t("auditLogs.noResults") : t("auditLogs.noLogs")}
              description={
                hasFilters
                  ? t("auditLogs.noResultsDescription")
                  : t("auditLogs.noLogsDescription")
              }
              action={
                hasFilters ? (
                  <button
                    type="button"
                    className="button-secondary text-xs"
                    onClick={clearAllFilters}
                  >
                    {t("auditLogs.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          }
          pagination={{
            page,
            pageSize: 15,
            pageCount: query.data?.meta.totalPages ?? 0,
            totalCount: query.data?.meta.total,
            onPageChange: (next) => setFilter("page", String(next)),
          }}
          renderMobileCard={(row) => (
            <article className="space-y-3 p-4 hover:bg-table-row-hover/40 transition-colors">
              {/* 1. Action (Primary Event Title) & Timestamp */}
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-foreground leading-snug">
                  {label("auditLogs.actions", row.action)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  <time dir="ltr" dateTime={row.createdAt}>
                    {formatDisplayDateTime(
                      new Date(row.createdAt),
                      i18n.language
                    )}
                  </time>
                </p>
              </div>

              {/* 2. Actor Profile */}
              {row.actor ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-7 shrink-0 rounded-full bg-surface-secondary text-[11px] font-semibold text-foreground flex items-center justify-center border border-border/80 shadow-2xs"
                    aria-hidden="true"
                  >
                    {getInitials(row.actor.name)}
                  </span>
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="truncate text-xs font-medium text-foreground" title={row.actor.name}>
                      {row.actor.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground" title={row.actor.email}>
                      <bdi dir="ltr">{row.actor.email}</bdi>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="size-7 shrink-0 rounded-full border border-dashed border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <Server className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {t("auditLogs.systemActor")}
                  </span>
                </div>
              )}

              {/* 3. Target Entity */}
              <div className="space-y-0.5 text-xs">
                <span className="font-medium text-foreground block">
                  {label("auditLogs.entityTypes", row.entityType)}
                </span>
                {row.entityId && (
                  <bdi
                    dir="ltr"
                    className="block font-mono text-[11px] text-muted-foreground max-w-full truncate"
                    title={row.entityId}
                  >
                    #{row.entityId}
                  </bdi>
                )}
              </div>

              {/* 4. Human-Readable Property Changes */}
              {Object.keys(row.changes).length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <ChangeSummary
                    changes={row.changes}
                    onViewDetails={() => {
                      detailTrigger.current = document.activeElement as HTMLButtonElement;
                      setSelected(row);
                    }}
                  />
                </div>
              )}

              {/* 5. Card Footer: Compact View action */}
              <div className="pt-2 border-t border-border/60 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded py-0.5"
                  aria-label={t("auditLogs.viewDetails")}
                  onClick={(event) => {
                    detailTrigger.current = event.currentTarget;
                    setSelected(row);
                  }}
                >
                  <span>{t("auditLogs.view", "View")}</span>
                  <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden="true" />
                </button>
              </div>
            </article>
          )}
        />

        {/* Mobile Filters Sheet */}
        <Sheet
          open={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title={t("common.filters", "Filters")}
          closeLabel={t("common.cancel")}
          returnFocusRef={mobileFilterTrigger}
        >
          <div className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("auditLogs.filters.action")}
              </label>
              <AppSelect
                ariaLabel={t("auditLogs.filters.action")}
                value={action}
                onValueChange={(val) => setFilter("action", val)}
                options={actionOptions}
                searchable
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("auditLogs.filters.entityType")}
              </label>
              <AppSelect
                ariaLabel={t("auditLogs.filters.entityType")}
                value={entityType}
                onValueChange={(val) => setFilter("entityType", val)}
                options={entityOptions}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("auditLogs.filters.actor")}
              </label>
              <AppSelect
                ariaLabel={t("auditLogs.filters.actor")}
                value={actorId}
                onValueChange={(val) => setFilter("actorId", val)}
                options={actorOptions}
                searchable
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("auditLogs.filters.dateRange")}
              </label>
              <DateRangePicker
                value={dateRangeValue}
                onChange={setDateRange}
                placeholder={t("auditLogs.filters.dateRange")}
                ariaLabel={t("auditLogs.filters.dateRange")}
                presets
              />
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              {activeFiltersCount > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    clearAllFilters();
                  }}
                  className="button-secondary text-xs"
                >
                  {t("auditLogs.clearFilters")}
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="button-primary text-xs"
              >
                {t("common.done", "Done")}
              </button>
            </div>
          </div>
        </Sheet>

        {/* Audit Details Sheet */}
        <Sheet
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          title={t("auditLogs.detailsTitle")}
          closeLabel={t("common.cancel")}
          returnFocusRef={detailTrigger}
          className="sm:max-w-[540px] lg:w-[580px] lg:max-w-[580px]"
        >
          {selected && (
            <div className="space-y-5 text-sm">
              {/* Action & Time Header */}
              <div className="space-y-1.5 pb-4 border-b border-border/80">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={getActionBadgeVariant(selected.action)}
                    size="default"
                    className="text-xs font-semibold"
                  >
                    {label("auditLogs.actions", selected.action)}
                  </Badge>
                  <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground break-all">
                    {selected.action}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  <time dir="ltr" dateTime={selected.createdAt}>
                    {formatDisplayDateTime(
                      new Date(selected.createdAt),
                      i18n.language
                    )}
                  </time>
                </p>
              </div>

              {/* Actor Section */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auditLogs.sections.actor")}
                </h3>
                {selected.actor ? (
                  <div className="flex items-start gap-3 py-1 min-w-0">
                    <span
                      className="size-8 shrink-0 rounded-full bg-surface-secondary text-xs font-semibold text-foreground flex items-center justify-center border border-border/80 shadow-2xs mt-0.5"
                      aria-hidden="true"
                    >
                      {getInitials(selected.actor.name)}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight space-y-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selected.actor.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <bdi dir="ltr">{selected.actor.email}</bdi>
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground/80 break-all">
                        <bdi dir="ltr">#{selected.actor.id}</bdi>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                    <Server className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
                    <span className="font-medium text-foreground">
                      {t("auditLogs.systemActor")}
                    </span>
                  </div>
                )}
              </section>

              {/* Target Entity Section */}
              <section className="space-y-2 pt-4 border-t border-border/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auditLogs.sections.entity")}
                </h3>
                <div className="flex flex-wrap items-center gap-2 py-0.5 text-xs min-w-0">
                  <span className="font-medium text-foreground text-sm">
                    {label("auditLogs.entityTypes", selected.entityType)}
                  </span>
                  {selected.entityId && (
                    <bdi
                      dir="ltr"
                      className="font-mono text-xs text-muted-foreground bg-surface-subtle/70 px-2 py-0.5 rounded border border-border/60 break-all"
                    >
                      #{selected.entityId}
                    </bdi>
                  )}
                </div>
              </section>

              {/* Property Changes Section */}
              <section className="space-y-2.5 pt-4 border-t border-border/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auditLogs.sections.changes")}
                </h3>
                {Object.keys(selected.changes).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(selected.changes).map(([key, change]) => (
                      <div
                        key={key}
                        className="rounded-lg border border-border/80 bg-surface-subtle/40 p-3 space-y-2"
                      >
                        <span className="font-semibold text-xs text-foreground uppercase tracking-wide block">
                          {formatPropertyLabel(key)}
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="rounded-md border border-border/60 bg-surface p-2.5 min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {t("auditLogs.diff.before")}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs block mt-1 break-words [overflow-wrap:anywhere]">
                              <bdi>{formatDiffValue(change.from)}</bdi>
                            </span>
                          </div>
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 min-w-0">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">
                              {t("auditLogs.diff.after")}
                            </span>
                            <span className="text-foreground font-semibold font-mono text-xs block mt-1 break-words [overflow-wrap:anywhere]">
                              <bdi>{formatDiffValue(change.to)}</bdi>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-0.5">
                    {t("auditLogs.diff.noChanges")}
                  </p>
                )}
              </section>

              {/* Additional Metadata Section */}
              {Object.keys(selected.metadata).length > 0 && (
                <section className="space-y-2 pt-4 border-t border-border/80">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("auditLogs.sections.metadata")}
                  </h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs py-0.5">
                    {Object.entries(selected.metadata).map(([k, v]) => (
                      <React.Fragment key={k}>
                        <dt className="font-medium text-muted-foreground">{k}:</dt>
                        <dd className="text-foreground font-mono break-words [overflow-wrap:anywhere]">
                          <bdi dir="ltr">{formatDiffValue(v)}</bdi>
                        </dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </section>
              )}

              {/* Request Context Section */}
              <section className="space-y-2.5 pt-4 border-t border-border/80">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("auditLogs.sections.context")}
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="font-medium text-muted-foreground">{t("auditLogs.ipAddress")}:</span>
                    <span className="font-mono text-foreground font-medium">
                      <bdi dir="ltr">{formatDiffValue(selected.ipAddress)}</bdi>
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Monitor className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{t("auditLogs.userAgent")}:</span>
                    </div>
                    {selected.userAgent ? (
                      <p className="rounded-md border border-border/60 bg-surface-subtle/50 p-2.5 font-mono text-[11px] text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                        <bdi dir="ltr">{selected.userAgent}</bdi>
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </Sheet>
      </div>
    </main>
  );
}
