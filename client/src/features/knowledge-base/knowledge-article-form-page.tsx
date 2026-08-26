import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getKnowledgeArticleError, getLocalizedKnowledgeArticleError } from "./knowledge-article-error";
import { useCreateKnowledgeArticle, useKnowledgeArticle, useUpdateKnowledgeArticle } from "./knowledge-article-hooks";
import { knowledgeArticleFormSchema, type KnowledgeArticleFormValues } from "./knowledge-article.schemas";
import { KnowledgeBasePage, LoadingRows, PageHeader, StatePanel } from "./knowledge-base-ui";

export function KnowledgeArticleFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const article = useKnowledgeArticle(id);
  const create = useCreateKnowledgeArticle();
  const update = useUpdateKnowledgeArticle(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<KnowledgeArticleFormValues>({
    resolver: zodResolver(knowledgeArticleFormSchema),
    defaultValues: { title: "", category: "", content: "", status: "DRAFT" },
  });

  useEffect(() => {
    if (isEditing && article.data) reset({ title: article.data.title, category: article.data.category ?? "", content: article.data.content, status: article.data.status });
  }, [isEditing, article.data, reset]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const saved = isEditing ? await update.mutateAsync(values) : await create.mutateAsync(values);
      navigate(`/knowledge-base/${saved.id}`, { replace: true });
    } catch (error) {
      setApiError(getLocalizedKnowledgeArticleError(error, t("knowledgeBase.saveError"), t));
    }
  });

  if (isEditing && article.isLoading) return <KnowledgeBasePage><LoadingRows /></KnowledgeBasePage>;
  if (isEditing && article.isError) {
    const error = getKnowledgeArticleError(article.error, t("knowledgeBase.loadError"));
    return <KnowledgeBasePage>
      <StatePanel>{error.status === 404 ? t("knowledgeBase.notFound") : getLocalizedKnowledgeArticleError(article.error, t("knowledgeBase.loadError"), t)}</StatePanel>
    </KnowledgeBasePage>;
  }

  const pending = isSubmitting || create.isPending || update.isPending;

  return <KnowledgeBasePage>
    <PageHeader title={isEditing ? t("knowledgeBase.editArticle") : t("knowledgeBase.createArticle")} description={t("knowledgeBase.formDescription")} />
    <form className="mt-6 max-w-3xl rounded-md border bg-white" onSubmit={submit} noValidate>
      <div className="space-y-5 p-5 sm:p-6">
        {apiError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{apiError}</p>}

        <Field id="kb-title" label={t("knowledgeBase.articleTitle")} required error={errors.title?.message ? t(errors.title.message) : undefined}>
          <input id="kb-title" className="input" dir="auto" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "kb-title-error" : undefined} {...register("title")} />
        </Field>

        <Field id="kb-category" label={t("knowledgeBase.articleCategory")} error={errors.category?.message ? t(errors.category.message) : undefined}>
          <input id="kb-category" className="input" dir="auto" aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "kb-category-error" : undefined} {...register("category")} />
        </Field>

        <Field id="kb-content" label={t("knowledgeBase.articleContent")} required error={errors.content?.message ? t(errors.content.message) : undefined}>
          <textarea id="kb-content" className="input min-h-64 resize-y" dir="auto" aria-invalid={Boolean(errors.content)} aria-describedby={errors.content ? "kb-content-error" : undefined} {...register("content")} />
        </Field>

        <Field id="kb-status" label={t("knowledgeBase.statusLabel")}>
          <select id="kb-status" className="input" {...register("status")}>
            <option value="DRAFT">{t("knowledgeBase.status.DRAFT")}</option>
            <option value="PUBLISHED">{t("knowledgeBase.status.PUBLISHED")}</option>
          </select>
          <span className="mt-1.5 block text-xs text-muted-foreground">{t("knowledgeBase.statusHelp")}</span>
        </Field>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <Link className="button-secondary text-center" to={isEditing ? `/knowledge-base/${id}` : "/knowledge-base"}>{t("common.cancel")}</Link>
        <button className="button-link" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
      </div>
    </form>
  </KnowledgeBasePage>;
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium" htmlFor={id}>{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
    <div className="mt-2">{children}</div>
    {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}
  </div>;
}
