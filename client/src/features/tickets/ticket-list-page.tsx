import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useAgents, useCategories, useTickets } from "./ticket-hooks";
import { TicketTable } from "./ticket-table";
import type { TicketPriority, TicketStatus } from "./ticket.types";
import { TicketPage, TicketPageHeader, TicketSkeleton, TicketState } from "./ticket-ui";

const statuses: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED", "ESCALATED"];
const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export function TicketListPage() {
  const { t } = useTranslation(); const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? ""; const debounced = useDebouncedValue(search); const rawPage = Number(params.get("page") ?? "1"); const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const status = statuses.includes(params.get("status") as TicketStatus) ? params.get("status") as TicketStatus : undefined;
  const priority = priorities.includes(params.get("priority") as TicketPriority) ? params.get("priority") as TicketPriority : undefined;
  const categoryId = params.get("categoryId") || undefined; const assignedAgentId = params.get("assignedAgentId") || undefined;
  const tickets = useTickets({ search: debounced, page, limit: 20, status, priority, categoryId, assignedAgentId }); const categories = useCategories(); const agents = useAgents();
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.delete("page"); setParams(next, { replace: key === "search" }); };
  const hasFilters = Boolean(debounced || status || priority || categoryId || assignedAgentId);
  const emptyMessage = getEmptyMessage({ search: debounced, status, priority, categoryId, assignedAgentId }, categories.data, agents.data, t);
  return <TicketPage><TicketPageHeader title={t("tickets.title")} description={t("tickets.description")} actions={<Link className="button-link" to="/tickets/new">{t("tickets.new")}</Link>} />
    <div className="my-6 grid gap-3 border-b pb-6 sm:grid-cols-2 lg:grid-cols-5"><label className="sm:col-span-2"><span className="sr-only">{t("tickets.search")}</span><input className="input" type="search" dir="auto" value={search} onChange={(event) => setFilter("search", event.target.value)} placeholder={t("tickets.search")} /></label>
      <FilterSelect label={t("tickets.statusLabel")} value={status ?? ""} onChange={(value) => setFilter("status", value)}><option value="">{t("tickets.allStatuses")}</option>{statuses.map((value) => <option key={value} value={value}>{t(`tickets.status.${value}`)}</option>)}</FilterSelect>
      <FilterSelect label={t("tickets.priorityLabel")} value={priority ?? ""} onChange={(value) => setFilter("priority", value)}><option value="">{t("tickets.allPriorities")}</option>{priorities.map((value) => <option key={value} value={value}>{t(`tickets.priority.${value}`)}</option>)}</FilterSelect>
      <FilterSelect label={t("tickets.category")} value={categoryId ?? ""} onChange={(value) => setFilter("categoryId", value)}><option value="">{t("tickets.allCategories")}</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>
      <FilterSelect label={t("tickets.assignedAgent")} value={assignedAgentId ?? ""} onChange={(value) => setFilter("assignedAgentId", value)}><option value="">{t("tickets.allAgents")}</option>{agents.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</FilterSelect>
      {hasFilters && <button className="button-ghost justify-self-start" onClick={() => setParams({})}>{t("tickets.clearFilters")}</button>}
    </div>
    {tickets.isLoading ? <TicketSkeleton /> : tickets.isError ? <TicketState action={<button className="button-secondary" onClick={() => tickets.refetch()}>{t("common.retry")}</button>}>{t("tickets.loadError")}</TicketState> : <TicketTable tickets={tickets.data?.data ?? []} emptyMessage={emptyMessage} page={page} pageSize={tickets.data?.meta.limit ?? 20} pageCount={tickets.data?.meta.totalPages ?? 0} onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")} />}
  </TicketPage>;
}
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) { return <label><span className="sr-only">{label}</span><select className="input" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>; }
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
