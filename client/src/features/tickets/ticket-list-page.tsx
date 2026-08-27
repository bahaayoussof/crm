import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useAgents, useCategories, useTickets } from "./ticket-hooks";
import { TicketTable } from "./ticket-table";
import type { TicketPriority, TicketStatus } from "./ticket.types";
import { TicketPage, TicketSkeleton, TicketState } from "./ticket-ui";

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
      <div className="space-y-6">
        <PageHeader
          title={t("tickets.title")}
          description={t("tickets.description")}
          actions={
            <Link className="button-link" to="/tickets/new">
              {t("tickets.new")}
            </Link>
          }
        />

        {/* Filter Bar */}
        <FilterBar className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="sm:col-span-2">
            <span className="sr-only">{t("tickets.search")}</span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                className="input ps-9"
                type="search"
                dir="auto"
                value={search}
                onChange={(event) => setFilter("search", event.target.value)}
                placeholder={t("tickets.search")}
              />
            </div>
          </label>
          <div>
            <AppSelect
              ariaLabel={t("tickets.statusLabel")}
              value={status ?? ""}
              onValueChange={(value) => setFilter("status", value)}
              options={statusOptions}
            />
          </div>
          <div>
            <AppSelect
              ariaLabel={t("tickets.priorityLabel")}
              value={priority ?? ""}
              onValueChange={(value) => setFilter("priority", value)}
              options={priorityOptions}
            />
          </div>
          <div>
            <AppSelect
              ariaLabel={t("tickets.category")}
              value={categoryId ?? ""}
              onValueChange={(value) => setFilter("categoryId", value)}
              options={categoryOptions}
            />
          </div>
          <div>
            <AppSelect
              ariaLabel={t("tickets.assignedAgent")}
              value={assignedAgentId ?? ""}
              onValueChange={(value) => setFilter("assignedAgentId", value)}
              options={agentOptions}
            />
          </div>
          {hasFilters && (
            <button
              className="button-ghost justify-self-start sm:col-span-2 lg:col-span-5"
              onClick={() => setParams({})}
            >
              {t("tickets.clearFilters")}
            </button>
          )}
        </FilterBar>

        {tickets.isLoading ? (
          <TicketSkeleton />
        ) : tickets.isError ? (
          <TicketState action={<Button variant="secondary" onClick={() => tickets.refetch()}>{t("common.retry")}</Button>}>
            {t("tickets.loadError")}
          </TicketState>
        ) : (
          <TicketTable
            tickets={tickets.data?.data ?? []}
            emptyMessage={emptyMessage}
            page={page}
            pageSize={tickets.data?.meta.limit ?? 20}
            pageCount={tickets.data?.meta.totalPages ?? 0}
            onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
          />
        )}
      </div>
    </TicketPage>
  );
}

function getEmptyMessage(filters: { search: string; status?: TicketStatus; priority?: TicketPriority; categoryId?: string; assignedAgentId?: string }, categories: { id: string; name: string }[] | undefined, agents: { id: string; name: string }[] | undefined, t: ReturnType<typeof useTranslation>["t"]) {
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
