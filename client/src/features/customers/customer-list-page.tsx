import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useCustomers } from "./customer-hooks";
import { formatDate } from "./customer-format";
import { CustomerPage, LoadingRows, PageHeader, StatePanel } from "./customer-ui";
import { useDebouncedValue } from "./use-debounced-value";

export function CustomerListPage() {
  const { t, i18n } = useTranslation();
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
    <div className="my-6"><label className="sr-only" htmlFor="customer-search">{t("customers.search")}</label><input id="customer-search" className="input max-w-md" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("customers.search")} /></div>
    {customers.isLoading ? <LoadingRows /> : customers.isError ? <StatePanel action={<button className="text-primary" onClick={() => customers.refetch()}>{t("common.retry")}</button>}>{t("customers.loadError")}</StatePanel> : customers.data?.data.length === 0 ? <StatePanel>{debouncedSearch ? t("customers.noMatches", { search: debouncedSearch }) : t("customers.empty")}</StatePanel> : <>
      <div className="hidden overflow-hidden rounded-md border bg-white md:block"><table className="w-full text-start text-sm"><thead className="bg-muted text-muted-foreground"><tr>{["name", "email", "phone", "openTickets", "totalTickets", "lastInteraction"].map((key) => <th className="px-4 py-3 text-start font-medium" key={key}>{t(`customers.${key}`)}</th>)}</tr></thead><tbody className="divide-y">{customers.data?.data.map((customer) => <tr key={customer.id}><td className="px-4 py-3 font-medium"><Link className="text-primary" to={`/customers/${customer.id}`}>{customer.name}</Link></td><td className="px-4 py-3" dir="ltr">{customer.email}</td><td className="px-4 py-3" dir="ltr">{customer.phone ?? "—"}</td><td className="px-4 py-3">{customer.openTicketCount}</td><td className="px-4 py-3">{customer.totalTicketCount}</td><td className="px-4 py-3 text-muted-foreground">{formatDate(customer.lastInteractionAt, i18n.language)}</td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{customers.data?.data.map((customer) => <Link className="block rounded-md border bg-white p-4" to={`/customers/${customer.id}`} key={customer.id}><p className="font-medium">{customer.name}</p><p className="mt-1 text-sm text-muted-foreground" dir="ltr">{customer.email}</p><div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{t("customers.openCount", { count: customer.openTicketCount })}</span><span>{formatDate(customer.lastInteractionAt, i18n.language)}</span></div></Link>)}</div>
      {(customers.data?.meta.totalPages ?? 0) > 1 && <nav className="mt-6 flex items-center justify-between" aria-label={t("customers.pagination")}><button className="button-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</button><span className="text-sm text-muted-foreground">{t("customers.page", { page, total: customers.data?.meta.totalPages })}</span><button className="button-secondary" disabled={page >= (customers.data?.meta.totalPages ?? 0)} onClick={() => setPage(page + 1)}>{t("common.next")}</button></nav>}
    </>}
  </CustomerPage>;
}
