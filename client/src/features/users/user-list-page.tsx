import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useUsers } from "./user-hooks";
import { UserTable } from "./user-table";
import { LoadingRows, NativeSelect, PageHeader, StatePanel, UsersPage } from "./users-ui";
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

  return <UsersPage>
    <PageHeader
      title={t("users.title")}
      description={t("users.description")}
      actions={<Link className="button-link" to="/users/new">{t("users.create")}</Link>}
    />
    <div className="my-6 flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-end">
      <label className="block w-full min-w-0 flex-1">
        <span className="sr-only">{t("users.search")}</span>
        <input className="input" type="search" dir="auto" value={search} onChange={(event) => setFilter("search", event.target.value)} placeholder={t("users.search")} />
      </label>
      <label className="block w-full sm:w-44">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("users.filterRole")}</span>
        <NativeSelect value={role ?? ""} onChange={(event) => setFilter("role", event.target.value)}>
          <option value="">{t("users.allRoles")}</option>
          {MANAGEABLE_ROLES.map((option) => <option key={option} value={option}>{t(`users.roles.${option}`)}</option>)}
        </NativeSelect>
      </label>
      <label className="block w-full sm:w-44">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">{t("users.filterStatus")}</span>
        <NativeSelect value={status ?? ""} onChange={(event) => setFilter("status", event.target.value)}>
          <option value="">{t("users.allStatuses")}</option>
          <option value="active">{t("users.status.active")}</option>
          <option value="inactive">{t("users.status.inactive")}</option>
        </NativeSelect>
      </label>
    </div>
    {users.isLoading ? <LoadingRows />
      : users.isError ? <StatePanel action={<button className="button-secondary" onClick={() => users.refetch()}>{t("common.retry")}</button>}>{t("users.loadError")}</StatePanel>
      : users.data && users.data.data.length === 0 ? <StatePanel action={hasFilters
          ? <button className="button-secondary" onClick={() => setParams({})}>{t("users.clearFilters")}</button>
          : <Link className="button-link" to="/users/new">{t("users.create")}</Link>}>
          {hasFilters ? t("users.noMatches") : t("users.empty")}
        </StatePanel>
      : <UserTable
          users={users.data?.data ?? []}
          currentUserId={currentUser?.id ?? ""}
          page={page}
          pageSize={users.data?.meta.limit ?? 20}
          pageCount={users.data?.meta.totalPages ?? 0}
          onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
        />}
  </UsersPage>;
}
