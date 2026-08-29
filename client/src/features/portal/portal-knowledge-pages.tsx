import axios from "axios";
import { ArrowLeft, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { formatTicketDate } from "@/features/tickets/ticket-format";
import { usePortalKnowledgeArticle, usePortalKnowledgeArticles } from "./portal-hooks";
import type { PortalKnowledgeArticle } from "./portal.types";
import { PortalPage } from "./portal-ui";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";

const errorCode = (error: unknown) => (axios.isAxiosError(error) ? (error.response?.data?.error?.code as string | undefined) : undefined);

function ArticleCard({ article }: { article: PortalKnowledgeArticle }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      className="block rounded-lg border border-border bg-card p-5 transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      to={`/portal/knowledge-base/${article.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-sm font-semibold text-foreground" dir="auto">{article.title}</h2>
        {article.category && <span className="shrink-0 rounded-md bg-surface-subtle border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground" dir="auto">{article.category}</span>}
      </div>
      {article.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground" dir="auto">{article.excerpt}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{t("portal.updated")}: <bdi dir="ltr">{formatTicketDate(article.updatedAt, i18n.language)}</bdi></p>
    </Link>
  );
}

export function PortalKnowledgeBasePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const query = usePortalKnowledgeArticles({ page, limit: 10, search, category: category.trim() || undefined });

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <PortalPage>
      <PageHeader title={t("portal.knowledgeBase.title")} description={t("portal.knowledgeBase.description")} />
      <FilterBar className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <label className="block" htmlFor="portal-kb-search">
          <span className="sr-only">{t("portal.knowledgeBase.search")}</span>
          <input className="input" id="portal-kb-search" dir="auto" value={search} onChange={(event) => update("search", event.target.value)} placeholder={t("portal.knowledgeBase.search")} />
        </label>
        <label className="block" htmlFor="portal-kb-category">
          <span className="sr-only">{t("portal.knowledgeBase.categoryFilter")}</span>
          <input className="input" id="portal-kb-category" dir="auto" value={category} onChange={(event) => update("category", event.target.value)} placeholder={t("portal.knowledgeBase.categoryFilter")} />
        </label>
      </FilterBar>

      <h2 className="mt-8 text-base font-semibold tracking-tight text-foreground">{t("portal.knowledgeBase.latestArticles")}</h2>
      {query.isLoading ? (
        <p className="mt-6 text-center text-sm text-muted-foreground" role="status">{t("portal.knowledgeBase.loading")}</p>
      ) : query.isError ? (
        <EmptyState
          className="mt-4"
          title={t("portal.knowledgeBase.loadError")}
          action={<button type="button" className="button-secondary" onClick={() => query.refetch()}>{t("common.retry")}</button>}
        />
      ) : query.data && query.data.data.length ? (
        <>
          <div className="mt-4 grid gap-3">{query.data.data.map((article) => <ArticleCard article={article} key={article.id} />)}</div>
          {query.data.meta.totalPages > 1 && (
            <nav aria-label={t("portal.pagination")} className="mt-5 flex items-center justify-between gap-3">
              <button className="button-secondary" disabled={page <= 1} onClick={() => update("page", String(page - 1))}>{t("common.previous")}</button>
              <span className="text-center text-xs font-medium text-muted-foreground">{t("portal.page", { page, total: query.data.meta.totalPages || 1 })}</span>
              <button className="button-secondary" disabled={page >= query.data.meta.totalPages} onClick={() => update("page", String(page + 1))}>{t("common.next")}</button>
            </nav>
          )}
        </>
      ) : (
        <EmptyState
          className="mt-4"
          icon={<Search className="size-5" aria-hidden="true" />}
          title={search || category.trim() ? t("portal.knowledgeBase.noMatches") : t("portal.knowledgeBase.empty")}
        />
      )}
    </PortalPage>
  );
}

export function PortalKnowledgeArticlePage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const query = usePortalKnowledgeArticle(id);

  const back = (
    <Link className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/portal/knowledge-base">
      <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
      <span>{t("portal.knowledgeBase.back")}</span>
    </Link>
  );

  if (query.isLoading) return <PortalPage><p className="mt-6 text-center text-sm text-muted-foreground" role="status">{t("portal.knowledgeBase.loadingDetail")}</p></PortalPage>;
  if (query.isError) {
    const notFound = errorCode(query.error) === "KNOWLEDGE_ARTICLE_NOT_FOUND";
    return (
      <PortalPage>
        <div className="mb-4">{back}</div>
        <EmptyState
          className="mt-2"
          title={notFound ? t("portal.knowledgeBase.notFound") : t("portal.knowledgeBase.detailError")}
          action={notFound ? undefined : <button type="button" className="button-secondary" onClick={() => query.refetch()}>{t("common.retry")}</button>}
        />
      </PortalPage>
    );
  }

  const article = query.data!;
  return (
    <PortalPage>
      <div className="mb-4">{back}</div>
      <header className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground" dir="auto">{article.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span dir="auto">{article.category ?? t("common.notProvided")}</span>
          <span>{t("portal.updated")}: <bdi dir="ltr">{formatTicketDate(article.updatedAt, i18n.language)}</bdi></span>
        </p>
      </header>
      <article className="mt-6 max-w-3xl rounded-md border border-border bg-card p-6 sm:p-8 whitespace-pre-wrap break-words text-sm leading-7 text-foreground" dir="auto">
        {article.content}
      </article>
    </PortalPage>
  );
}
