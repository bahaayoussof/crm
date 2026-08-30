import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/ui/modal";
import { getLocalizedQuickReplyError } from "./quick-reply-error";
import { useCreateQuickReply } from "./quick-reply-hooks";
import { quickReplyFormSchema, type QuickReplyFormValues } from "./quick-reply.schemas";

export interface QuickReplyCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function QuickReplyCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: QuickReplyCreateModalProps) {
  const { t } = useTranslation();
  const create = useCreateQuickReply();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuickReplyFormValues>({
    resolver: zodResolver(quickReplyFormSchema),
    defaultValues: { title: "", body: "" },
  });

  const handleClose = () => {
    reset();
    setApiError(null);
    onOpenChange(false);
  };

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await create.mutateAsync(values);
      handleClose();
      onSuccess?.();
    } catch (error) {
      setApiError(getLocalizedQuickReplyError(error, t("quickReplies.saveError"), t));
    }
  });

  const pending = isSubmitting || create.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("quickReplies.createTitle")}
      description={t("quickReplies.formDescription")}
      maxWidth="lg"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {apiError && (
          <p
            className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-xs text-danger-foreground"
            role="alert"
          >
            {apiError}
          </p>
        )}

        <div>
          <label htmlFor="modal-qr-title" className="block text-xs font-medium text-foreground">
            {t("quickReplies.fieldTitle")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-qr-title"
            className="input mt-1"
            dir="auto"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "modal-qr-title-error" : undefined}
            {...register("title")}
          />
          {errors.title?.message && (
            <p id="modal-qr-title-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.title.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-qr-body" className="block text-xs font-medium text-foreground">
            {t("quickReplies.fieldBody")} <span className="text-danger">*</span>
          </label>
          <textarea
            id="modal-qr-body"
            rows={4}
            className="textarea mt-1"
            dir="auto"
            aria-invalid={Boolean(errors.body)}
            aria-describedby={errors.body ? "modal-qr-body-error" : undefined}
            {...register("body")}
          />
          {errors.body?.message && (
            <p id="modal-qr-body-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.body.message)}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="button-secondary text-xs"
            disabled={pending}
            onClick={handleClose}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="button-link text-xs"
            disabled={pending}
          >
            {pending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
