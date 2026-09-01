import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { PhoneInput } from "@/components/shared/phone-input";
import { AppSelectField } from "@/components/ui/app-select";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-state";
import { getLocalizedUserError } from "./user-error";
import { useUpdateUser } from "./user-hooks";
import { UserBranchDepartmentFields } from "./user-org-fields";
import { mapUserToEditFormValues, userEditFormSchema, type UserEditFormValues } from "./user.schemas";
import { MANAGEABLE_ROLES, type User } from "./user.types";

export interface UserEditModalProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserEditModal({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserEditModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("users.editTitle")}
      description={t("users.editDescription")}
      maxWidth="lg"
    >
      {user && (
        // `key={user.id}` mounts a fresh `useForm` per selected user, seeded
        // synchronously from the canonical mapper — identical to the full Edit
        // User page's `EditUserFormLoaded`. No post-mount `reset(...)`, so the
        // lone `role` <Controller> can never be skipped by a partial broadcast,
        // and opening the modal for a different user always replaces every
        // field (role included) rather than reusing the previous form state.
        <UserEditModalForm
          key={user.id}
          user={user}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}

function UserEditModalForm({
  user,
  onClose,
  onSuccess,
}: {
  user: User;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const update = useUpdateUser(user.id);
  const [apiError, setApiError] = useState<string | null>(null);

  const isSelf = Boolean(currentUser && user.id === currentUser.id);

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditFormSchema),
    defaultValues: mapUserToEditFormValues(user),
  });

  const roleOptions = MANAGEABLE_ROLES.map((option) => ({
    value: option,
    label: t(`users.roles.${option}`),
  }));

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await update.mutateAsync({
        name: values.name,
        email: values.email,
        role: values.role,
        phone: values.phone || null,
        isActive: values.isActive,
        departmentId: values.departmentId ? values.departmentId : null,
        branchId: values.branchId ? values.branchId : null,
      });
      onClose();
      onSuccess?.();
    } catch (error) {
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  const pending = isSubmitting || update.isPending;

  return (
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
          {t("users.fieldName")} <span className="text-danger">*</span>
        </label>
        <input
          id="modal-edit-user-name"
          className="input mt-1"
          dir="auto"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "modal-edit-user-name-error" : undefined}
          {...register("name")}
        />
        {errors.name?.message && (
          <p id="modal-edit-user-name-error" role="alert" className="mt-1 text-xs text-danger">
            {t(errors.name.message)}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="modal-edit-user-email" className="block text-xs font-medium text-foreground">
          {t("users.fieldEmail")} <span className="text-danger">*</span>
        </label>
        <input
          id="modal-edit-user-email"
          className="input mt-1 text-start"
          dir="ltr"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "modal-edit-user-email-error" : undefined}
          {...register("email")}
        />
        {errors.email?.message && (
          <p id="modal-edit-user-email-error" role="alert" className="mt-1 text-xs text-danger">
            {t(errors.email.message)}
          </p>
        )}
      </div>

      <div>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <AppSelectField
              id="modal-edit-user-role"
              label={t("users.fieldRole")}
              value={field.value}
              options={roleOptions}
              onValueChange={field.onChange}
              disabled={isSelf}
              helperText={isSelf ? t("users.selfRoleReadonly") : undefined}
              error={errors.role?.message ? t(errors.role.message) : undefined}
            />
          )}
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

      <UserBranchDepartmentFields control={control} setValue={setValue} idPrefix="modal-edit-user" />

      <div className="rounded-lg border border-border bg-surface-subtle/50 p-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary/30"
            disabled={isSelf}
            {...register("isActive")}
          />
          <span>
            <span className="block text-xs font-medium text-foreground">{t("users.fieldActive")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {isSelf ? t("users.selfDeactivateBlocked") : t("users.activeHelp")}
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="button-secondary text-xs"
          disabled={pending}
          onClick={onClose}
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
  );
}
