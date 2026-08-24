import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useCustomers } from "./customer-hooks";
import { CustomerTable } from "./customer-table";
import { CustomerPage, LoadingRows, PageHeader, StatePanel } from "./customer-ui";
import { useDebouncedValue } from "./use-debounced-value";

export function CustomerListPage() {
  const { t } = useTranslation();
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

  return <CustomerPage>
    <PageHeader title={t("customers.title")} description={t("customers.description")} actions={<Link className="button-link" to="/customers/new">{t("customers.add")}</Link>} />
    <div className="my-6 flex items-center gap-3 border-b pb-6"><label className="sr-only" htmlFor="customer-search">{t("customers.search")}</label><input id="customer-search" className="input max-w-sm" dir="auto" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("customers.search")} /></div>
    {customers.isLoading ? <LoadingRows /> : customers.isError ? <StatePanel action={<button className="button-secondary" onClick={() => customers.refetch()}>{t("common.retry")}</button>}>{t("customers.loadError")}</StatePanel> : customers.data?.data.length === 0 ? <StatePanel action={debouncedSearch ? <button className="button-secondary" onClick={() => setSearch("")}>{t("common.clearSearch")}</button> : <Link className="button-link" to="/customers/new">{t("customers.add")}</Link>}>{debouncedSearch ? t("customers.noMatches", { search: debouncedSearch }) : t("customers.empty")}</StatePanel> : <CustomerTable customers={customers.data?.data ?? []} page={page} pageSize={customers.data?.meta.limit ?? 20} pageCount={customers.data?.meta.totalPages ?? 0} onPageChange={setPage} />}
  </CustomerPage>;
}
