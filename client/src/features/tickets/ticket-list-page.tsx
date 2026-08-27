import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useAgents, useCategories, useTickets } from "./ticket-hooks";
import { TicketTable } from "./ticket-table";
import { TicketFiltersPopover } from "./ticket-filters-popover";
import type { TicketPriority, TicketStatus } from "./ticket.types";
import { TicketPage, TicketState } from "./ticket-ui";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"];
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function TicketListPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const debounced = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const status = statuses.includes(params.get("status") as TicketStatus) ? (params.get("status") as TicketStatus) : undefined;
  const priority = priorities.includes(params.get("priority") as TicketPriority) ? (params.get("priority") as TicketPriority) : undefined;
  const categoryId = params.get("categoryId") || undefined;
  const assignedAgentId = params.get("assignedAgentId") || undefined;

  const tickets = useTickets({ search: debounced, page, limit: 20, status, priority, categoryId, assignedAgentId });
  const categories = useCategories();
  const agents = useAgents();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debounced || status || priority || categoryId || assignedAgentId);
  const emptyMessage = getEmptyMessage({ search: debounced, status, priority, categoryId, assignedAgentId }, categories.data, agents.data, t);

  const statusOptions = [
    { value: "", label: t("tickets.allStatuses") },
    ...statuses.map((value) => ({ value, label: t(`tickets.status.${value}`) })),
  ];

  const priorityOptions = [
    { value: "", label: t("tickets.allPriorities") },
    ...priorities.map((value) => ({ value, label: t(`tickets.priority.${value}`) })),
  ];

  const categoryOptions = [
    { value: "", label: t("tickets.allCategories") },
    ...(categories.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];

  const agentOptions = [
    { value: "", label: t("tickets.allAgents") },
    ...(agents.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];

  return (
    <TicketPage>
      <div className="space-y-5">
        <PageHeader
          title={t("tickets.title")}
          description={t("tickets.description")}
          actions={
            <Link className="button-link" to="/tickets/new">
              {t("tickets.new")}
            </Link>
          }
        />

        {/* Unified Table Surface Card */}
        <DataTableSurface>
          {/* Single-Row Compact Toolbar */}
          <DataTableToolbar>
            {/* Search Input */}
            <DataTableSearch
              id="ticket-search"
              ariaLabel={t("tickets.search")}
              value={search}
              onChange={(value) => setFilter("search", value)}
              placeholder={t("tickets.search")}
            />

            {/* Right-Side Toolbar Controls */}
            <div className="flex items-center gap-2 shrink-0 sm:ms-auto">
              {/* Secondary Filters Popover (Priority, Category, Agent) */}
              <TicketFiltersPopover
                priority={priority}
                categoryId={categoryId}
                assignedAgentId={assignedAgentId}
                priorityOptions={priorityOptions}
                categoryOptions={categoryOptions}
                agentOptions={agentOptions}
                onFilterChange={setFilter}
                onClearFilters={() => {
                  const next = new URLSearchParams(params);
                  next.delete("priority");
                  next.delete("categoryId");
                  next.delete("assignedAgentId");
                  setParams(next);
                }}
              />

              {/* Status Select Directly on Toolbar */}
              <div className="w-32 sm:w-36">
                <AppSelect
                  ariaLabel={t("tickets.statusLabel")}
                  value={status ?? ""}
                  onValueChange={(value) => setFilter("status", value)}
                  options={statusOptions}
                />
              </div>

              {/* Clear All Filters button if active */}
              {hasFilters && (
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("tickets.clearFilters")}
                </button>
              )}
            </div>
          </DataTableToolbar>

          {/* Table Body & Loading / Error States */}
          {tickets.isLoading ? (
            <div className="p-4" aria-label="loading">
              <DataTableSkeleton columns={8} />
            </div>
          ) : tickets.isError ? (
            <div className="p-6">
              <TicketState action={<Button variant="secondary" onClick={() => tickets.refetch()}>{t("common.retry")}</Button>}>
                {t("tickets.loadError")}
              </TicketState>
            </div>
          ) : (
            <TicketTable
              tickets={tickets.data?.data ?? []}
              emptyMessage={emptyMessage}
              page={page}
              pageSize={tickets.data?.meta.limit ?? 20}
              pageCount={tickets.data?.meta.totalPages ?? 0}
              totalCount={tickets.data?.meta.total}
              onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
            />
          )}
        </DataTableSurface>
      </div>
    </TicketPage>
  );
}

function getEmptyMessage(
  filters: { search: string; status?: TicketStatus; priority?: TicketPriority; categoryId?: string; assignedAgentId?: string },
  categories: { id: string; name: string }[] | undefined,
  agents: { id: string; name: string }[] | undefined,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const active = [filters.search, filters.status, filters.priority, filters.categoryId, filters.assignedAgentId].filter(Boolean);
  if (active.length === 0) return t("tickets.empty");
  if (active.length > 1) return t("tickets.noMatches");
  if (filters.search) return t("tickets.noSearchMatches", { search: filters.search });
  if (filters.status) return t("tickets.noStatusMatches", { status: t(`tickets.status.${filters.status}`) });
  if (filters.priority) return t("tickets.noPriorityMatches", { priority: t(`tickets.priority.${filters.priority}`) });
  if (filters.categoryId) {
    const category = categories?.find((item) => item.id === filters.categoryId)?.name;
    return category ? t("tickets.noCategoryMatches", { category }) : t("tickets.noMatches");
  }
  const agent = agents?.find((item) => item.id === filters.assignedAgentId)?.name;
  return agent ? t("tickets.noAgentMatches", { agent }) : t("tickets.noMatches");
}
