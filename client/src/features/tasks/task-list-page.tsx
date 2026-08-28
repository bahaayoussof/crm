import { useTranslation } from "react-i18next";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import {
  DataTableSearch,
  DataTableSkeleton,
  DataTableSurface,
  DataTableToolbar,
} from "@/components/shared/data-table";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useAgents } from "@/features/tickets/ticket-hooks";
import { useTasks } from "./task-hooks";
import { canAssignTasks, canUseTasks } from "./task-permissions";
import { TaskTable } from "./task-table";
import { PageHeader, StatePanel, TasksPage } from "./tasks-ui";
import type { TaskStatus } from "./task.types";

const STATUSES: TaskStatus[] = ["OPEN", "DONE"];

export function TaskListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const status = STATUSES.includes(params.get("status") as TaskStatus)
    ? (params.get("status") as TaskStatus)
    : undefined;

  const canAssign = Boolean(user && canAssignTasks(user.role));
  const assigneeId = canAssign ? params.get("assigneeId") || undefined : undefined;

  const agents = useAgents();
  const tasks = useTasks({
    search: debouncedSearch,
    page,
    limit: 20,
    status,
    assigneeId,
  });

  if (user && !canUseTasks(user.role)) return <Navigate to="/dashboard" replace />;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debouncedSearch || status || assigneeId);

  const statusOptions = [
    { value: "", label: t("tasks.allStatuses") },
    ...STATUSES.map((value) => ({ value, label: t(`tasks.status.${value}`) })),
  ];
  const assigneeOptions = [
    { value: "", label: t("tasks.allAssignees") },
    ...(agents.data?.map((agent) => ({ value: agent.id, label: agent.name, searchText: agent.email })) ?? []),
  ];

  return (
    <TasksPage>
      <div className="space-y-5">
        <PageHeader
          title={t("tasks.title")}
          description={t("tasks.description")}
          actions={
            <Link className="button-link" to="/tasks/new">
              {t("tasks.create")}
            </Link>
          }
        />

        <DataTableSurface>
          <DataTableToolbar>
            <DataTableSearch
              id="task-search"
              ariaLabel={t("tasks.search")}
              value={search}
              onChange={(value) => setFilter("search", value)}
              placeholder={t("tasks.search")}
            />

            <div className="flex shrink-0 items-center gap-2 sm:ms-auto">
              <AppSelect
                ariaLabel={t("tasks.columns.status")}
                value={status ?? ""}
                onValueChange={(value) => setFilter("status", value)}
                options={statusOptions}
                triggerClassName="h-8.5 min-w-[9rem] text-xs"
              />
              {canAssign && (
                <AppSelect
                  ariaLabel={t("tasks.columns.assignee")}
                  searchable
                  searchPlaceholder={t("tickets.searchAssignee")}
                  emptySearchMessage={t("tickets.noAssigneesFound")}
                  value={assigneeId ?? ""}
                  onValueChange={(value) => setFilter("assigneeId", value)}
                  options={assigneeOptions}
                  triggerClassName="h-8.5 min-w-[10rem] text-xs"
                />
              )}
              {hasFilters && (
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("tasks.clearFilters")}
                </button>
              )}
            </div>
          </DataTableToolbar>

          {tasks.isLoading || !user ? (
            <div className="p-4" aria-label={t("common.loading")}>
              <DataTableSkeleton columns={5} />
            </div>
          ) : tasks.isError ? (
            <div className="p-6">
              <StatePanel
                action={
                  <button className="button-secondary" onClick={() => tasks.refetch()}>
                    {t("common.retry")}
                  </button>
                }
              >
                {t("tasks.loadError")}
              </StatePanel>
            </div>
          ) : tasks.data && tasks.data.data.length === 0 ? (
            <div className="p-6">
              <StatePanel
                action={
                  hasFilters ? (
                    <button className="button-secondary" onClick={() => setParams({})}>
                      {t("tasks.clearFilters")}
                    </button>
                  ) : (
                    <Link className="button-link" to="/tasks/new">
                      {t("tasks.create")}
                    </Link>
                  )
                }
              >
                {hasFilters ? t("tasks.noMatches") : t("tasks.empty")}
              </StatePanel>
            </div>
          ) : (
            <TaskTable
              tasks={tasks.data?.data ?? []}
              currentUserId={user.id}
              currentUserRole={user.role}
              page={page}
              pageSize={tasks.data?.meta.limit ?? 20}
              pageCount={tasks.data?.meta.totalPages ?? 0}
              totalCount={tasks.data?.meta.total}
              onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
            />
          )}
        </DataTableSurface>
      </div>
    </TasksPage>
  );
}
