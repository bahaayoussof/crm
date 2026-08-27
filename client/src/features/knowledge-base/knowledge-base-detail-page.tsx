import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { formatArticleDate } from "./knowledge-article-format";
import { getKnowledgeArticleError, getLocalizedKnowledgeArticleError } from "./knowledge-article-error";
import { useDeleteKnowledgeArticle, useKnowledgeArticle } from "./knowledge-article-hooks";
import { canManageKnowledgeArticles } from "./knowledge-article-permissions";
import { ArticleStatusBadge, KnowledgeBasePage, LoadingRows, PageHeader, StatePanel } from "./knowledge-base-ui";

export function KnowledgeBaseDetailPage() {
  const { id = "" } = useParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = Boolean(user && canManageKnowledgeArticles(user.role));

  const article = useKnowledgeArticle(id);
  const remove = useDeleteKnowledgeArticle();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const back = (
    <Link className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" to="/knowledge-base">
      <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
      <span>{t("knowledgeBase.backToList")}</span>
    </Link>
  );

  if (article.isLoading) return <KnowledgeBasePage><LoadingRows /></KnowledgeBasePage>;
  if (article.isError) {
    const error = getKnowledgeArticleError(article.error, t("knowledgeBase.loadError"));
    return (
      <KnowledgeBasePage>
        <div className="mb-4">{back}</div>
        <StatePanel action={error.status === 404 ? undefined : <button className="button-secondary" onClick={() => article.refetch()}>{t("common.retry")}</button>}>
          {error.status === 404 ? t("knowledgeBase.notFound") : getLocalizedKnowledgeArticleError(article.error, t("knowledgeBase.loadError"), t)}
        </StatePanel>
      </KnowledgeBasePage>
    );
  }

  const data = article.data!;

  const confirmDelete = async () => {
    if (remove.isPending) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(data.id);
      navigate("/knowledge-base", { replace: true });
    } catch (error) {
      setDeleteError(getLocalizedKnowledgeArticleError(error, t("knowledgeBase.deleteError"), t));
    }
  };

  return (
    <KnowledgeBasePage>
      <div className="space-y-6">
        <div>{back}</div>
        <PageHeader
          title={data.title}
          description={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ArticleStatusBadge status={data.status} />
              <span dir="auto">{data.category ?? t("common.notProvided")}</span>
              <span>{t("knowledgeBase.updatedOn")}: <bdi dir="ltr">{formatArticleDate(data.updatedAt, i18n.language)}</bdi></span>
              <span dir="auto">{t("knowledgeBase.authorName", { name: data.createdBy.name })}</span>
            </div>
          }
          actions={
            canManage ? (
              <>
                <Link className="button-secondary" to={`/knowledge-base/${data.id}/edit`}>{t("knowledgeBase.edit")}</Link>
                <button className="button-danger" type="button" onClick={() => { setConfirmingDelete(true); setDeleteError(null); }}>{t("knowledgeBase.delete")}</button>
              </>
            ) : undefined
          }
        />

        {confirmingDelete && canManage && (
          <section className="rounded-xl border border-danger-subtle bg-danger-subtle/40 p-4" role="alertdialog" aria-labelledby="kb-delete-title" aria-describedby="kb-delete-desc">
            <h2 className="text-sm font-semibold text-danger-foreground" id="kb-delete-title">{t("knowledgeBase.deleteTitle")}</h2>
            <p className="mt-1 text-sm text-danger-foreground/90" id="kb-delete-desc">{t("knowledgeBase.deleteConfirm")}</p>
            {deleteError && <p className="mt-2 text-sm text-danger" role="alert">{deleteError}</p>}
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
              <button className="button-secondary" type="button" disabled={remove.isPending} onClick={() => setConfirmingDelete(false)}>{t("knowledgeBase.cancelDelete")}</button>
              <button className="button-danger" type="button" disabled={remove.isPending} onClick={confirmDelete}>{remove.isPending ? t("knowledgeBase.deleting") : t("knowledgeBase.confirmDelete")}</button>
            </div>
          </section>
        )}

        <article className="rounded-xl border border-border bg-surface p-6 sm:p-8 max-w-3xl whitespace-pre-wrap break-words text-sm leading-7 text-foreground shadow-subtle" dir="auto">
          {data.content}
        </article>
      </div>
    </KnowledgeBasePage>
  );
}
