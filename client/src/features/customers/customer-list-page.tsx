import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useCustomers } from "./customer-hooks";
import { CustomerTable } from "./customer-table";
import { CustomerPage, PageHeader, StatePanel } from "./customer-ui";
import { useDebouncedValue } from "./use-debounced-value";
import { useAuth } from "@/features/auth/auth-state";
import { canManageCustomers } from "./customer-permissions";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";

export function CustomerListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = Boolean(user && canManageCustomers(user.role));
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const parsedPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const debouncedSearch = useDebouncedValue(search);
  const customers = useCustomers({ search: debouncedSearch, page, limit: 20 });

  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("search", value);
    else next.delete("search");
    next.delete("page");
    setParams(next, { replace: true });
  };
  const setPage = (value: number) => {
    const next = new URLSearchParams(params);
    if (value > 1) next.set("page", String(value));
    else next.delete("page");
    setParams(next);
  };

  return (
    <CustomerPage>
      <div className="space-y-5">
        <PageHeader
          title={t("customers.title")}
          description={t("customers.description")}
          actions={canManage ? <Link className="button-link" to="/customers/new">{t("customers.add")}</Link> : undefined}
        />

        {/* Unified DataTable Surface */}
        <DataTableSurface>
          {/* Shared Single-Row Compact Toolbar */}
          <DataTableToolbar>
            {/* Search Input */}
            <DataTableSearch
              id="customer-search"
              ariaLabel={t("customers.search")}
              value={search}
              onChange={setSearch}
              placeholder={t("customers.search")}
            />

            {/* Right-Side Actions */}
            {debouncedSearch && (
              <div className="flex items-center gap-2 sm:ms-auto">
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch("")}
                >
                  {t("common.clearSearch")}
                </button>
              </div>
            )}
          </DataTableToolbar>

          {/* Table Body & Loading / Error / Empty States */}
          {customers.isLoading ? (
            <div className="p-4" aria-label={t("common.loading")}>
              <DataTableSkeleton columns={6} />
            </div>
          ) : customers.isError ? (
            <div className="p-6">
              <StatePanel action={<button className="button-secondary" onClick={() => customers.refetch()}>{t("common.retry")}</button>}>
                {t("customers.loadError")}
              </StatePanel>
            </div>
          ) : customers.data?.data.length === 0 ? (
            <div className="p-6">
              <StatePanel action={debouncedSearch ? <button className="button-secondary" onClick={() => setSearch("")}>{t("common.clearSearch")}</button> : canManage ? <Link className="button-link" to="/customers/new">{t("customers.add")}</Link> : undefined}>
                {debouncedSearch ? t("customers.noMatches", { search: debouncedSearch }) : t("customers.empty")}
              </StatePanel>
            </div>
          ) : (
            <CustomerTable
              customers={customers.data?.data ?? []}
              page={page}
              pageSize={customers.data?.meta.limit ?? 20}
              pageCount={customers.data?.meta.totalPages ?? 0}
              totalCount={customers.data?.meta.total}
              onPageChange={setPage}
            />
          )}
        </DataTableSurface>
      </div>
    </CustomerPage>
  );
}
