import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PhoneInput } from "@/components/shared/phone-input";
import { Modal } from "@/components/ui/modal";
import { optionalPhoneInputSchema } from "@/lib/phone";
import { getLocalizedUserError } from "./user-error";
import { useUpdateUser } from "./user-hooks";
import type { User } from "./user.types";

export interface UserEditModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const editUserModalSchema = z.object({
  phone: optionalPhoneInputSchema,
  isActive: z.boolean().optional(),
});

type EditUserModalValues = z.infer<typeof editUserModalSchema>;

export function UserEditModal({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserEditModalProps) {
  const { t } = useTranslation();
  const update = useUpdateUser(user?.id ?? "");
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditUserModalValues>({
    resolver: zodResolver(editUserModalSchema),
    defaultValues: { phone: user?.phone ?? "", isActive: user?.isActive ?? true },
  });

  useEffect(() => {
    if (open && user) {
      reset({ phone: user.phone ?? "", isActive: user.isActive });
      setApiError(null);
    }
  }, [open, user, reset]);

  if (!user) return null;

  const handleClose = () => {
    reset();
    setApiError(null);
    onOpenChange(false);
  };

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await update.mutateAsync({
        phone: values.phone || null,
        isActive: values.isActive,
      });
      handleClose();
      onSuccess?.();
    } catch (error) {
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  const pending = isSubmitting || update.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("users.editTitle")}
      description={t("users.editDescription")}
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
          <label htmlFor="modal-edit-user-name" className="block text-xs font-medium text-foreground">
            {t("users.fieldName")}
          </label>
          <input
            id="modal-edit-user-name"
            className="input mt-1 bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
            dir="auto"
            readOnly
            disabled
            value={user.name}
          />
        </div>

        <div>
          <label htmlFor="modal-edit-user-email" className="block text-xs font-medium text-foreground">
            {t("users.fieldEmail")}
          </label>
          <input
            id="modal-edit-user-email"
            className="input mt-1 text-start bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
            dir="ltr"
            type="email"
            readOnly
            disabled
            value={user.email}
          />
        </div>

        <div>
          <label htmlFor="modal-edit-user-role" className="block text-xs font-medium text-foreground">
            {t("users.fieldRole")}
          </label>
          <input
            id="modal-edit-user-role"
            className="input mt-1 bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
            readOnly
            disabled
            value={t(`users.roles.${user.role}`) || user.role}
          />
        </div>

        <div>
          <label htmlFor="modal-edit-user-phone" className="block text-xs font-medium text-foreground">
            {t("users.fieldPhone")}
          </label>
          <div className="mt-1">
            <Controller
              name="phone"
              control={control}
              render={({ field, fieldState }) => (
                <PhoneInput
                  id="modal-edit-user-phone"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  aria-describedby={errors.phone ? "modal-edit-user-phone-error" : undefined}
                />
              )}
            />
          </div>
          {errors.phone?.message && (
            <p id="modal-edit-user-phone-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.phone.message)}
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-subtle/50 p-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary/30"
              {...register("isActive")}
            />
            <span>
              <span className="block text-xs font-medium text-foreground">{t("users.fieldActive")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("users.activeHelp")}
              </span>
            </span>
          </label>
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
