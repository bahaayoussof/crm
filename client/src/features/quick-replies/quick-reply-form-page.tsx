import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { RichTextEditorHandle } from "@/components/shared/rich-text/rich-text-editor";
import { getLocalizedQuickReplyError, getQuickReplyError } from "./quick-reply-error";
import { QuickReplyBodyField } from "./quick-reply-body-field";
import { useCreateQuickReply, useQuickReply, useUpdateQuickReply } from "./quick-reply-hooks";
import { quickReplyFormSchema, type QuickReplyFormValues } from "./quick-reply.schemas";
import { LoadingRows, PageHeader, QuickRepliesPage, StatePanel } from "./quick-replies-ui";

export function QuickReplyFormPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  const quickReply = useQuickReply(id);
  const create = useCreateQuickReply();
  const update = useUpdateQuickReply(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const hydratedRef = useRef<string | null>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<QuickReplyFormValues>({
    resolver: zodResolver(quickReplyFormSchema),
    values: isEditing && quickReply.data
      ? { title: quickReply.data.title, body: quickReply.data.body }
      : { title: "", body: "" },
  });

  // Hydrate the editor from the loaded quick reply exactly once (rich HTML or
  // legacy plain text — the editor handles both). User edits after this flow
  // through `field.onChange` and are never overwritten.
  useEffect(() => {
    if (!isEditing || !quickReply.data) return;
    if (hydratedRef.current === quickReply.data.id) return;
    hydratedRef.current = quickReply.data.id;
    editorRef.current?.setHtml(quickReply.data.body);
  }, [isEditing, quickReply.data]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      if (isEditing) await update.mutateAsync(values);
      else await create.mutateAsync(values);
      navigate("/quick-replies", { replace: true });
    } catch (error) {
      setApiError(getLocalizedQuickReplyError(error, t("quickReplies.saveError"), t));
    }
  });

  if (isEditing && quickReply.isLoading) return <QuickRepliesPage><LoadingRows /></QuickRepliesPage>;
  if (isEditing && quickReply.isError) {
    const error = getQuickReplyError(quickReply.error, t("quickReplies.loadError"));
    return (
      <QuickRepliesPage>
        <StatePanel>{error.status === 404 ? t("quickReplies.notFound") : getLocalizedQuickReplyError(quickReply.error, t("quickReplies.loadError"), t)}</StatePanel>
      </QuickRepliesPage>
    );
  }

  const pending = isSubmitting || create.isPending || update.isPending;

  return (
    <QuickRepliesPage>
      <div className="space-y-6">
        <PageHeader title={isEditing ? t("quickReplies.editTitle") : t("quickReplies.createTitle")} description={t("quickReplies.formDescription")} />
        <form className="max-w-3xl rounded-xl border border-border bg-surface shadow-subtle" onSubmit={submit} noValidate>
          <div className="space-y-5 p-5 sm:p-6">
            {apiError && <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">{apiError}</p>}

            <Field id="qr-title" label={t("quickReplies.fieldTitle")} required error={errors.title?.message ? t(errors.title.message) : undefined}>
              <input id="qr-title" className="input" dir="auto" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "qr-title-error" : undefined} {...register("title")} />
            </Field>

            <Field id="qr-body" label={t("quickReplies.fieldBody")} required error={errors.body?.message ? t(errors.body.message) : undefined}>
              <QuickReplyBodyField
                ref={editorRef}
                id="qr-body"
                control={control}
                ariaLabel={t("quickReplies.fieldBody")}
                ariaDescribedBy={errors.body ? "qr-body-error" : "qr-body-help"}
                ariaInvalid={Boolean(errors.body)}
                editorHeightClassName="min-h-48 max-h-[32rem]"
              />
              <span className="mt-1.5 block text-xs text-muted-foreground" id="qr-body-help">{t("quickReplies.bodyHelp")}</span>
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-subtle/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 rounded-b-xl">
            <Link className="button-secondary text-center" to="/quick-replies">{t("common.cancel")}</Link>
            <button className="button-link" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
          </div>
        </form>
      </div>
    </QuickRepliesPage>
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
