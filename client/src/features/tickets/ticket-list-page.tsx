import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useBranchOptions, useDepartmentOptions } from "@/features/organization/organization-hooks";
import { useAuth } from "@/features/auth/auth-state";
import { useAgents, useCategories, useClaimTicket, useTickets } from "./ticket-hooks";
import { getTicketError } from "./ticket-error";
import { TicketTable } from "./ticket-table";
import { TicketFiltersPopover } from "./ticket-filters-popover";
import type { TicketListScope, TicketPriority, TicketStatus } from "./ticket.types";
import { TicketPage, TicketState } from "./ticket-ui";

const statuses: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"];
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const agentScopes: TicketListScope[] = ["mine", "unassigned"];

export function TicketListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAgent = user?.role === "AGENT";
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const debounced = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const status = statuses.includes(params.get("status") as TicketStatus) ? (params.get("status") as TicketStatus) : undefined;
  const priority = priorities.includes(params.get("priority") as TicketPriority) ? (params.get("priority") as TicketPriority) : undefined;
  const categoryId = params.get("categoryId") || undefined;
  const assignedAgentId = isAgent ? undefined : params.get("assignedAgentId") || undefined;
  const departmentId = params.get("departmentId") || undefined;
  const branchId = params.get("branchId") || undefined;
  // AGENT ticket lists are one of two explicit scopes — My Tickets (default) or
  // the Unassigned queue. There is no "all" view. Ignored for other roles.
  const scope: TicketListScope | undefined = isAgent
    ? (params.get("scope") === "unassigned" ? "unassigned" : "mine")
    : undefined;

  const tickets = useTickets({ search: debounced, page, limit: 20, scope, status, priority, categoryId, assignedAgentId, departmentId, branchId });
  const categories = useCategories();
  const agents = useAgents();
  const departments = useDepartmentOptions();
  const branches = useBranchOptions();
  const claim = useClaimTicket();
  const claimError = claim.isError ? getTicketError(claim.error, t("tickets.claimError"), t) : null;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debounced || status || priority || categoryId || assignedAgentId || departmentId || branchId);
  const emptyMessage = getEmptyMessage({ search: debounced, status, priority, categoryId, assignedAgentId, departmentId, branchId }, categories.data, agents.data, t);

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
    ...(agents.data?.map((item) => ({ value: item.id, label: item.name, searchText: item.email })) ?? []),
  ];

  const departmentOptions = [
    { value: "", label: t("tickets.allDepartments") },
    ...(departments.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
  ];

  const branchOptions = [
    { value: "", label: t("tickets.allBranches") },
    ...(branches.data?.map((item) => ({ value: item.id, label: item.name })) ?? []),
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

        {isAgent && (
          <div
            className="inline-flex rounded-lg border border-border bg-surface p-0.5"
            role="tablist"
            aria-label={t("tickets.scopeLabel")}
          >
            {agentScopes.map((value) => {
              const activeScope = scope === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={activeScope}
                  onClick={() => setFilter("scope", value === "mine" ? "" : value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    activeScope
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`tickets.scope.${value}`)}
                </button>
              );
            })}
          </div>
        )}

        {claimError && (
          <p
            className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground"
            role="alert"
          >
            {claimError}
          </p>
        )}

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
              {/* Filters Popover (Status, Priority, Category, Agent) */}
              <TicketFiltersPopover
                status={status}
                priority={priority}
                categoryId={categoryId}
                assignedAgentId={assignedAgentId}
                departmentId={departmentId}
                branchId={branchId}
                statusOptions={statusOptions}
                priorityOptions={priorityOptions}
                categoryOptions={categoryOptions}
                agentOptions={agentOptions}
                departmentOptions={departmentOptions}
                branchOptions={branchOptions}
                showAgentFilter={!isAgent}
                onFilterChange={setFilter}
                onClearFilters={() => {
                  const next = new URLSearchParams(params);
                  next.delete("status");
                  next.delete("priority");
                  next.delete("categoryId");
                  next.delete("assignedAgentId");
                  next.delete("departmentId");
                  next.delete("branchId");
                  setParams(next);
                }}
              />

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
              showClaim={isAgent && scope === "unassigned"}
              claimingId={claim.isPending ? claim.variables?.id ?? null : null}
              onClaim={(ticketId) => {
                if (user) claim.mutate({ id: ticketId, agentId: user.id });
              }}
            />
          )}
        </DataTableSurface>
      </div>
    </TicketPage>
  );
}

function getEmptyMessage(
  filters: { search: string; status?: TicketStatus; priority?: TicketPriority; categoryId?: string; assignedAgentId?: string; departmentId?: string; branchId?: string },
  categories: { id: string; name: string }[] | undefined,
  agents: { id: string; name: string }[] | undefined,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const active = [filters.search, filters.status, filters.priority, filters.categoryId, filters.assignedAgentId, filters.departmentId, filters.branchId].filter(Boolean);
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
