import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppSelectField } from "@/components/ui/app-select";
import { getKnowledgeArticleError, getLocalizedKnowledgeArticleError } from "./knowledge-article-error";
import { KnowledgeArticleEditor, type KnowledgeArticleEditorHandle } from "./knowledge-article-editor";
import { useCreateKnowledgeArticle, useKnowledgeArticle, useUpdateKnowledgeArticle } from "./knowledge-article-hooks";
import { knowledgeArticleFormSchema, type KnowledgeArticleFormValues } from "./knowledge-article.schemas";
import { KnowledgeBasePage, LoadingRows, PageHeader, StatePanel } from "./knowledge-base-ui";

const STATUSES = ["DRAFT", "PUBLISHED"] as const;

export function KnowledgeArticleFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const article = useKnowledgeArticle(id);
  const create = useCreateKnowledgeArticle();
  const update = useUpdateKnowledgeArticle(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const editorRef = useRef<KnowledgeArticleEditorHandle>(null);
  const hydratedRef = useRef<string | null>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<KnowledgeArticleFormValues>({
    resolver: zodResolver(knowledgeArticleFormSchema),
    values: isEditing && article.data
      ? {
          title: article.data.title,
          category: article.data.category ?? "",
          content: article.data.content,
          status: article.data.status,
        }
      : {
          title: "",
          category: "",
          content: "",
          status: "DRAFT",
        },
  });

  // Hydrate the editor from the loaded article body exactly once (rich HTML or
  // legacy plain text — the editor handles both). User edits after this flow
  // through `field.onChange` and are never overwritten.
  useEffect(() => {
    if (!isEditing || !article.data) return;
    if (hydratedRef.current === article.data.id) return;
    hydratedRef.current = article.data.id;
    editorRef.current?.setHtml(article.data.content);
  }, [isEditing, article.data]);

  const statusOptions = STATUSES.map((value) => ({
    value,
    label: t(`knowledgeBase.status.${value}`),
  }));

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
    return (
      <KnowledgeBasePage>
        <StatePanel>{error.status === 404 ? t("knowledgeBase.notFound") : getLocalizedKnowledgeArticleError(article.error, t("knowledgeBase.loadError"), t)}</StatePanel>
      </KnowledgeBasePage>
    );
  }

  const pending = isSubmitting || create.isPending || update.isPending;

  return (
    <KnowledgeBasePage>
      <div className="space-y-6">
        <PageHeader title={isEditing ? t("knowledgeBase.editArticle") : t("knowledgeBase.createArticle")} description={t("knowledgeBase.formDescription")} />
        <form className="max-w-3xl rounded-xl border border-border bg-surface shadow-subtle" onSubmit={submit} noValidate>
          <div className="space-y-5 p-5 sm:p-6">
            {apiError && <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">{apiError}</p>}

            <Field id="kb-title" label={t("knowledgeBase.articleTitle")} required error={errors.title?.message ? t(errors.title.message) : undefined}>
              <input id="kb-title" className="input" dir="auto" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "kb-title-error" : undefined} {...register("title")} />
            </Field>

            <Field id="kb-category" label={t("knowledgeBase.articleCategory")} error={errors.category?.message ? t(errors.category.message) : undefined}>
              <input id="kb-category" className="input" dir="auto" aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "kb-category-error" : undefined} {...register("category")} />
            </Field>

            <Field id="kb-content" label={t("knowledgeBase.articleContent")} required error={errors.content?.message ? t(errors.content.message) : undefined}>
              <Controller
                name="content"
                control={control}
                render={({ field }) => (
                  <KnowledgeArticleEditor
                    ref={editorRef}
                    id="kb-content"
                    ariaLabel={t("knowledgeBase.editor.ariaLabel")}
                    ariaDescribedBy={errors.content ? "kb-content-error" : undefined}
                    ariaInvalid={Boolean(errors.content)}
                    onChange={(html) => field.onChange(html)}
                  />
                )}
              />
            </Field>

            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <AppSelectField
                  id="kb-status"
                  label={t("knowledgeBase.statusLabel")}
                  labelClassName="block text-sm font-medium text-foreground"
                  value={field.value}
                  onValueChange={field.onChange}
                  helperText={t("knowledgeBase.statusHelp")}
                  options={statusOptions}
                />
              )}
            />
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-subtle/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 rounded-b-xl">
            <Link className="button-secondary text-center" to={isEditing ? `/knowledge-base/${id}` : "/knowledge-base"}>{t("common.cancel")}</Link>
            <button className="button-link" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </KnowledgeBasePage>
  );
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>
        {label}
        {required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      <div className="mt-2">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
