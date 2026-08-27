import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import { FilterBar } from "@/components/shared/filter-bar";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useUsers } from "./user-hooks";
import { UserTable } from "./user-table";
import { LoadingRows, PageHeader, StatePanel, UsersPage } from "./users-ui";
import { MANAGEABLE_ROLES, type ManageableRole } from "./user.types";

const STATUSES = ["active", "inactive"] as const;

export function UserListPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [params, setParams] = useSearchParams();

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const roleParam = params.get("role");
  const role = MANAGEABLE_ROLES.includes(roleParam as ManageableRole) ? (roleParam as ManageableRole) : undefined;
  const statusParam = params.get("status");
  const status = STATUSES.includes(statusParam as (typeof STATUSES)[number]) ? (statusParam as "active" | "inactive") : undefined;
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const users = useUsers({ search: debouncedSearch, role, status, page, limit: 20 });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debouncedSearch || role || status);

  const roleOptions = [
    { value: "", label: t("users.allRoles") },
    ...MANAGEABLE_ROLES.map((option) => ({
      value: option,
      label: t(`users.roles.${option}`),
    })),
  ];

  const statusOptions = [
    { value: "", label: t("users.allStatuses") },
    { value: "active", label: t("users.status.active") },
    { value: "inactive", label: t("users.status.inactive") },
  ];

  return (
    <UsersPage>
      <div className="space-y-6">
        <PageHeader
          title={t("users.title")}
          description={t("users.description")}
          actions={<Link className="button-link" to="/users/new">{t("users.create")}</Link>}
        />
        <FilterBar className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block w-full min-w-0 flex-1">
            <span className="sr-only">{t("users.search")}</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <input
                className="input ps-9"
                type="search"
                dir="auto"
                value={search}
                onChange={(event) => setFilter("search", event.target.value)}
                placeholder={t("users.search")}
              />
            </div>
          </label>
          <div className="w-full sm:w-44">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("users.filterRole")}</span>
            <AppSelect
              ariaLabel={t("users.filterRole")}
              value={role ?? ""}
              onValueChange={(val) => setFilter("role", val)}
              options={roleOptions}
            />
          </div>
          <div className="w-full sm:w-44">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("users.filterStatus")}</span>
            <AppSelect
              ariaLabel={t("users.filterStatus")}
              value={status ?? ""}
              onValueChange={(val) => setFilter("status", val)}
              options={statusOptions}
            />
          </div>
          {hasFilters && (
            <button className="button-ghost" onClick={() => setParams({})}>
              {t("users.clearFilters")}
            </button>
          )}
        </FilterBar>
        {users.isLoading ? (
          <LoadingRows />
        ) : users.isError ? (
          <StatePanel action={<button className="button-secondary" onClick={() => users.refetch()}>{t("common.retry")}</button>}>
            {t("users.loadError")}
          </StatePanel>
        ) : users.data && users.data.data.length === 0 ? (
          <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("users.clearFilters")}</button> : <Link className="button-link" to="/users/new">{t("users.create")}</Link>}>
            {hasFilters ? t("users.noMatches") : t("users.empty")}
          </StatePanel>
        ) : (
          <UserTable
            users={users.data?.data ?? []}
            currentUserId={currentUser?.id ?? ""}
            page={page}
            pageSize={users.data?.meta.limit ?? 20}
            pageCount={users.data?.meta.totalPages ?? 0}
            onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
          />
        )}
      </div>
    </UsersPage>
  );
}
