import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AppSelect } from "@/components/ui/app-select";
import {
  DataTableSurface,
  DataTableToolbar,
  DataTableSearch,
  DataTableSkeleton,
} from "@/components/shared/data-table";
import { useAuth } from "@/features/auth/auth-state";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useKnowledgeArticles } from "./knowledge-article-hooks";
import { canManageKnowledgeArticles } from "./knowledge-article-permissions";
import { KnowledgeArticleTable } from "./knowledge-article-table";
import type { KnowledgeArticleStatus } from "./knowledge-article.types";
import { KnowledgeBasePage, PageHeader, StatePanel } from "./knowledge-base-ui";

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
      <div className="space-y-5">
        <PageHeader
          title={t("knowledgeBase.title")}
          description={t("knowledgeBase.description")}
          actions={canManage ? <Link className="button-link" to="/knowledge-base/new">{t("knowledgeBase.create")}</Link> : undefined}
        />

        {/* Unified DataTable Surface */}
        <DataTableSurface>
          {/* Shared Single-Row Compact Toolbar */}
          <DataTableToolbar>
            {/* Search Input */}
            <DataTableSearch
              id="kb-search"
              ariaLabel={t("knowledgeBase.search")}
              value={search}
              onChange={(value) => setFilter("search", value)}
              placeholder={t("knowledgeBase.search")}
            />

            {/* Right-Side Filter Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
              <div className="w-32 sm:w-36">
                <AppSelect
                  ariaLabel={t("knowledgeBase.statusFilter")}
                  value={status ?? ""}
                  onValueChange={(value) => setFilter("status", value)}
                  options={statusOptions}
                />
              </div>

              <div className="w-32 sm:w-36">
                <label htmlFor="kb-category-filter" className="sr-only">
                  {t("knowledgeBase.categoryFilter")}
                </label>
                <input
                  id="kb-category-filter"
                  className="input h-8.5 text-xs rounded-lg bg-surface/50 border-input-border placeholder:text-muted-foreground/70"
                  dir="auto"
                  value={params.get("category") ?? ""}
                  onChange={(event) => setFilter("category", event.target.value)}
                  placeholder={t("knowledgeBase.categoryFilter")}
                />
              </div>

              {hasFilters && (
                <button
                  className="button-ghost h-8.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setParams({})}
                >
                  {t("knowledgeBase.clearFilters")}
                </button>
              )}
            </div>
          </DataTableToolbar>

          {/* Table Body & Loading / Error / Empty States */}
          {articles.isLoading ? (
            <div className="p-4" aria-label={t("common.loading")}>
              <DataTableSkeleton columns={5} />
            </div>
          ) : articles.isError ? (
            <div className="p-6">
              <StatePanel action={<button className="button-secondary" onClick={() => articles.refetch()}>{t("common.retry")}</button>}>
                {t("knowledgeBase.loadError")}
              </StatePanel>
            </div>
          ) : articles.data && articles.data.data.length === 0 ? (
            <div className="p-6">
              <StatePanel action={hasFilters ? <button className="button-secondary" onClick={() => setParams({})}>{t("knowledgeBase.clearFilters")}</button> : canManage ? <Link className="button-link" to="/knowledge-base/new">{t("knowledgeBase.create")}</Link> : undefined}>
                {hasFilters ? t("knowledgeBase.noMatches") : t("knowledgeBase.empty")}
              </StatePanel>
            </div>
          ) : (
            <KnowledgeArticleTable
              articles={articles.data?.data ?? []}
              page={page}
              pageSize={articles.data?.meta.limit ?? 20}
              pageCount={articles.data?.meta.totalPages ?? 0}
              totalCount={articles.data?.meta.total}
              onPageChange={(nextPage) => setFilter("page", nextPage > 1 ? String(nextPage) : "")}
            />
          )}
        </DataTableSurface>
      </div>
    </KnowledgeBasePage>
  );
}
