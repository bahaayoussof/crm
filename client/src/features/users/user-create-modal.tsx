import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AppSelectField } from "@/components/ui/app-select";
import { Modal } from "@/components/ui/modal";
import { getLocalizedUserError } from "./user-error";
import { useCreateUser } from "./user-hooks";
import { userCreateFormSchema, type UserCreateFormValues } from "./user.schemas";
import { MANAGEABLE_ROLES } from "./user.types";

export interface UserCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserCreateModal({
  open,
  onOpenChange,
  onSuccess,
}: UserCreateModalProps) {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    control,
    reset,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "AGENT" },
  });

  const roleOptions = MANAGEABLE_ROLES.map((option) => ({
    value: option,
    label: t(`users.roles.${option}`),
  }));

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
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  const pending = isSubmitting || create.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("users.createTitle")}
      description={t("users.formDescription")}
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
          <label htmlFor="modal-user-name" className="block text-xs font-medium text-foreground">
            {t("users.fieldName")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-user-name"
            className="input mt-1"
            dir="auto"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "modal-user-name-error" : undefined}
            {...register("name")}
          />
          {errors.name?.message && (
            <p id="modal-user-name-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.name.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-user-email" className="block text-xs font-medium text-foreground">
            {t("users.fieldEmail")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-user-email"
            className="input mt-1 text-start"
            dir="ltr"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "modal-user-email-error" : undefined}
            {...register("email")}
          />
          {errors.email?.message && (
            <p id="modal-user-email-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.email.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="modal-user-password" className="block text-xs font-medium text-foreground">
            {t("users.fieldPassword")} <span className="text-danger">*</span>
          </label>
          <input
            id="modal-user-password"
            className="input mt-1 text-start"
            dir="ltr"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "modal-user-password-error" : undefined}
            {...register("password")}
          />
          {errors.password?.message && (
            <p id="modal-user-password-error" role="alert" className="mt-1 text-xs text-danger">
              {t(errors.password.message)}
            </p>
          )}
        </div>

        <div>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <AppSelectField
                id="modal-user-role"
                label={t("users.fieldRole")}
                value={field.value}
                options={roleOptions}
                onValueChange={field.onChange}
                error={errors.role?.message ? t(errors.role.message) : undefined}
              />
            )}
          />
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
