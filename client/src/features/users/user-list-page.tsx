import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useUsers } from "./user-hooks";
import { UserTable } from "./user-table";
import { UserCreateModal } from "./user-create-modal";
import { PageHeader, StatePanel, UsersPage } from "./users-ui";
import { MANAGEABLE_ROLES, type ManageableRole } from "./user.types";

const STATUSES = ["active", "inactive"] as const;

export function UserListPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const roleParam = params.get("role");
  const role = MANAGEABLE_ROLES.includes(roleParam as ManageableRole) ? (roleParam as ManageableRole) : undefined;
  const statusParam = params.get("status");
  const status = STATUSES.includes(statusParam as (typeof STATUSES)[number]) ? (statusParam as "active" | "inactive") : undefined;
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const users = useUsers({ search: debouncedSearch, role, status, page, limit: 15 });

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
      <div className="space-y-5">
        <PageHeader
          title={t("users.title")}
          description={t("users.description")}
          actions={<button type="button" className="button-link" onClick={() => setCreateOpen(true)}>{t("users.create")}</button>}
        />

        {/* Unified DataTable Surface */}
        <DataTableSurface>
          {/* Shared Single-Row Compact Toolbar */}
          <DataTableToolbar>
            {/* Search Input */}
            <DataTableSearch
              id="user-search"
              ariaLabel={t("users.search")}
              value={search}
              onChange={(value) => setFilter("search", value)}
              placeholder={t("users.search")}
            />

            {/* Right-Side Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
              <div className="w-32 sm:w-36">
                <AppSelect
                  ariaLabel={t("users.filterRole")}
                  value={role ?? ""}
                  onValueChange={(val) => setFilter("role", val)}
                  options={roleOptions}
                />
              </div>

              <div className="w-32 sm:w-36">
                <AppSelect
                  ariaLabel={t("users.filterStatus")}
                  value={status ?? ""}
                  onValueChange={(val) => setFilter("status", val)}
                  options={statusOptions}
                />
              </div>

              {hasFilters && (
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("users.clearFilters")}
                </button>
              )}
            </div>
          </DataTableToolbar>

          {/* Table Body & Loading / Error / Empty States */}
          {users.isLoading ? (
            <div className="p-4">
              <DataTableSkeleton columns={6} />
            </div>
          ) : users.isError ? (
            <div className="p-6">
              <StatePanel action={<button className="button-secondary" onClick={() => users.refetch()}>{t("common.retry")}</button>}>
                {t("users.loadError")}
              </StatePanel>
            </div>
          ) : users.data && users.data.data.length === 0 ? (
            <div className="p-6">
              <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("users.clearFilters")}</button> : <button type="button" className="button-link" onClick={() => setCreateOpen(true)}>{t("users.create")}</button>}>
                {hasFilters ? t("users.noMatches") : t("users.empty")}
              </StatePanel>
            </div>
          ) : (
            <UserTable
              users={users.data?.data ?? []}
              currentUserId={currentUser?.id ?? ""}
              page={page}
              pageSize={users.data?.meta.limit ?? 20}
              pageCount={users.data?.meta.totalPages ?? 0}
              totalCount={users.data?.meta.total}
              onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
            />
          )}
        </DataTableSurface>

        <UserCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => users.refetch()}
        />
      </div>
    </UsersPage>
  );
}
