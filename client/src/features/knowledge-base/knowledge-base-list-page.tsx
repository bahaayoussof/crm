import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import { FilterBar } from "@/components/shared/filter-bar";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useKnowledgeArticles } from "./knowledge-article-hooks";
import { canManageKnowledgeArticles } from "./knowledge-article-permissions";
import { KnowledgeArticleTable } from "./knowledge-article-table";
import type { KnowledgeArticleStatus } from "./knowledge-article.types";
import { KnowledgeBasePage, LoadingRows, PageHeader, StatePanel } from "./knowledge-base-ui";

const statuses: KnowledgeArticleStatus[] = ["DRAFT", "PUBLISHED"];

export function KnowledgeBaseListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = Boolean(user && canManageKnowledgeArticles(user.role));
  const [params, setParams] = useSearchParams();

  const search = params.get("search") ?? "";
  const debouncedSearch = useDebouncedValue(search);
  const categoryInput = params.get("category") ?? "";
  const debouncedCategory = useDebouncedValue(categoryInput);
  const category = debouncedCategory.trim() || undefined;
  const rawPage = Number(params.get("page") ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const status = statuses.includes(params.get("status") as KnowledgeArticleStatus) ? (params.get("status") as KnowledgeArticleStatus) : undefined;

  const articles = useKnowledgeArticles({ search: debouncedSearch, page, limit: 20, status, category });

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: key === "search" || key === "category" });
  };

  const hasFilters = Boolean(debouncedSearch || status || category);

  const statusOptions = [
    { value: "", label: t("knowledgeBase.allStatuses") },
    ...statuses.map((value) => ({ value, label: t(`knowledgeBase.status.${value}`) })),
  ];

  return (
    <KnowledgeBasePage>
      <div className="space-y-6">
        <PageHeader
          title={t("knowledgeBase.title")}
          description={t("knowledgeBase.description")}
          actions={canManage ? <Link className="button-link" to="/knowledge-base/new">{t("knowledgeBase.create")}</Link> : undefined}
        />
        <FilterBar className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="sr-only">{t("knowledgeBase.search")}</span>
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
                placeholder={t("knowledgeBase.search")}
              />
            </div>
          </label>
          <div>
            <AppSelect
              ariaLabel={t("knowledgeBase.statusFilter")}
              value={status ?? ""}
              onValueChange={(value) => setFilter("status", value)}
              options={statusOptions}
            />
          </div>
          <label>
            <span className="sr-only">{t("knowledgeBase.categoryFilter")}</span>
            <input className="input" dir="auto" value={params.get("category") ?? ""} onChange={(event) => setFilter("category", event.target.value)} placeholder={t("knowledgeBase.categoryFilter")} />
          </label>
          {hasFilters && (
            <button className="button-ghost sm:col-span-2 lg:col-span-4 justify-self-start" onClick={() => setParams({})}>
              {t("knowledgeBase.clearFilters")}
            </button>
          )}
        </FilterBar>
        {articles.isLoading ? (
          <LoadingRows />
        ) : articles.isError ? (
          <StatePanel action={<button className="button-secondary" onClick={() => articles.refetch()}>{t("common.retry")}</button>}>
            {t("knowledgeBase.loadError")}
          </StatePanel>
        ) : articles.data && articles.data.data.length === 0 ? (
          <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("knowledgeBase.clearFilters")}</button> : canManage ? <Link className="button-link" to="/knowledge-base/new">{t("knowledgeBase.create")}</Link> : undefined}>
            {hasFilters ? t("knowledgeBase.noMatches") : t("knowledgeBase.empty")}
          </StatePanel>
        ) : (
          <KnowledgeArticleTable
            articles={articles.data?.data ?? []}
            page={page}
            pageSize={articles.data?.meta.limit ?? 20}
            pageCount={articles.data?.meta.totalPages ?? 0}
            onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
          />
        )}
      </div>
    </KnowledgeBasePage>
  );
}
