import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { FilterBar } from "@/components/shared/filter-bar";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useQuickReplies } from "./quick-reply-hooks";
import { QuickReplyTable } from "./quick-reply-table";
import { LoadingRows, PageHeader, QuickRepliesPage, StatePanel } from "./quick-replies-ui";

export function QuickReplyListPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const quickReplies = useQuickReplies({ search: debouncedSearch, page, limit: 20 });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" });
  };

  const hasFilters = Boolean(debouncedSearch);

  return (
    <QuickRepliesPage>
      <div className="space-y-6">
        <PageHeader
          title={t("quickReplies.title")}
          description={t("quickReplies.description")}
          actions={<Link className="button-link" to="/quick-replies/new">{t("quickReplies.create")}</Link>}
        />
        <FilterBar className="my-6">
          <div className="relative w-full max-w-md">
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
            <label className="sr-only" htmlFor="quick-reply-search">{t("quickReplies.search")}</label>
            <input
              id="quick-reply-search"
              className="input ps-9"
              type="search"
              dir="auto"
              value={search}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder={t("quickReplies.search")}
            />
          </div>
          {hasFilters && (
            <button className="button-ghost" onClick={() => setParams({})}>
              {t("quickReplies.clearFilters")}
            </button>
          )}
        </FilterBar>
        {quickReplies.isLoading ? (
          <LoadingRows />
        ) : quickReplies.isError ? (
          <StatePanel action={<button className="button-secondary" onClick={() => quickReplies.refetch()}>{t("common.retry")}</button>}>
            {t("quickReplies.loadError")}
          </StatePanel>
        ) : quickReplies.data && quickReplies.data.data.length === 0 ? (
          <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("quickReplies.clearFilters")}</button> : <Link className="button-link" to="/quick-replies/new">{t("quickReplies.create")}</Link>}>
            {hasFilters ? t("quickReplies.noMatches") : t("quickReplies.empty")}
          </StatePanel>
        ) : (
          <QuickReplyTable
            quickReplies={quickReplies.data?.data ?? []}
            page={page}
            pageSize={quickReplies.data?.meta.limit ?? 20}
            pageCount={quickReplies.data?.meta.totalPages ?? 0}
            onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
          />
        )}
      </div>
    </QuickRepliesPage>
  );
}
