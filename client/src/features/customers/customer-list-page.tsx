import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useCustomers } from "./customer-hooks";
import { CustomerTable } from "./customer-table";
import { CustomerPage, LoadingRows, PageHeader, StatePanel } from "./customer-ui";
import { useDebouncedValue } from "./use-debounced-value";
import { useAuth } from "@/features/auth/auth-state";
import { canManageCustomers } from "./customer-permissions";
import { FilterBar } from "@/components/shared/filter-bar";

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
      <div className="space-y-6">
        <PageHeader
          title={t("customers.title")}
          description={t("customers.description")}
          actions={canManage ? <Link className="button-link" to="/customers/new">{t("customers.add")}</Link> : undefined}
        />
        <FilterBar className="my-6">
          <div className="relative w-full max-w-sm">
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
            <label className="sr-only" htmlFor="customer-search">{t("customers.search")}</label>
            <input
              id="customer-search"
              className="input ps-9"
              dir="auto"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("customers.search")}
            />
          </div>
          {debouncedSearch && (
            <button className="button-ghost" onClick={() => setSearch("")}>
              {t("common.clearSearch")}
            </button>
          )}
        </FilterBar>
        {customers.isLoading ? (
          <LoadingRows />
        ) : customers.isError ? (
          <StatePanel action={<button className="button-secondary" onClick={() => customers.refetch()}>{t("common.retry")}</button>}>
            {t("customers.loadError")}
          </StatePanel>
        ) : customers.data?.data.length === 0 ? (
          <StatePanel action={debouncedSearch ? <button className="button-secondary" onClick={() => setSearch("")}>{t("common.clearSearch")}</button> : canManage ? <Link className="button-link" to="/customers/new">{t("customers.add")}</Link> : undefined}>
            {debouncedSearch ? t("customers.noMatches", { search: debouncedSearch }) : t("customers.empty")}
          </StatePanel>
        ) : (
          <CustomerTable
            customers={customers.data?.data ?? []}
            page={page}
            pageSize={customers.data?.meta.limit ?? 20}
            pageCount={customers.data?.meta.totalPages ?? 0}
            onPageChange={setPage}
          />
        )}
      </div>
    </CustomerPage>
  );
}
