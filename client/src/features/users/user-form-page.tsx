import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppSelectField } from "@/components/ui/app-select";
import { useAuth } from "@/features/auth/auth-state";
import { getLocalizedUserError, getUserError } from "./user-error";
import { useCreateUser, useUpdateUser, useUser } from "./user-hooks";
import { userCreateFormSchema, userEditFormSchema, type UserCreateFormValues, type UserEditFormValues } from "./user.schemas";
import { LoadingRows, PageHeader, StatePanel, UsersPage, YouBadge } from "./users-ui";
import { MANAGEABLE_ROLES } from "./user.types";

export function UserFormPage() {
  const { id = "" } = useParams();
  const isEditing = Boolean(id);
  return isEditing ? <EditUserForm id={id} /> : <CreateUserForm />;
}

function CreateUserForm() {
  const { t } = useTranslation();
  const create = useCreateUser();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "AGENT" },
  });

  const roleOptions = MANAGEABLE_ROLES.map((option) => ({
    value: option,
    label: t(`users.roles.${option}`),
  }));

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await create.mutateAsync(values);
      navigate("/users", { replace: true });
    } catch (error) {
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  const pending = isSubmitting || create.isPending;

  return (
    <UsersPage>
      <div className="space-y-6">
        <PageHeader title={t("users.createTitle")} description={t("users.formDescription")} />
        <form className="max-w-3xl rounded-xl border border-border bg-surface shadow-subtle" onSubmit={submit} noValidate>
          <div className="space-y-5 p-5 sm:p-6">
            {apiError && <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">{apiError}</p>}

            <Field id="user-name" label={t("users.fieldName")} required error={errors.name?.message ? t(errors.name.message) : undefined}>
              <input id="user-name" className="input" dir="auto" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "user-name-error" : undefined} {...register("name")} />
            </Field>

            <Field id="user-email" label={t("users.fieldEmail")} required error={errors.email?.message ? t(errors.email.message) : undefined}>
              <input id="user-email" type="email" className="input" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "user-email-error" : undefined} {...register("email")} />
            </Field>

            <Field id="user-password" label={t("users.fieldPassword")} required error={errors.password?.message ? t(errors.password.message) : undefined}>
              <input id="user-password" type="password" className="input" dir="ltr" autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "user-password-error" : "user-password-help"} {...register("password")} />
              <span className="mt-1.5 block text-xs text-muted-foreground" id="user-password-help">{t("users.passwordHelp")}</span>
            </Field>

            <Controller
              name="role"
              control={control}
              render={({ field, fieldState }) => (
                <AppSelectField
                  id="user-role"
                  label={t("users.fieldRole")}
                  required
                  value={field.value}
                  onValueChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  options={roleOptions}
                />
              )}
            />
          </div>
          <FormFooter pending={pending} />
        </form>
      </div>
    </UsersPage>
  );
}

function EditUserForm({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const user = useUser(id);
  const update = useUpdateUser(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const isSelf = Boolean(user.data && currentUser && user.data.id === currentUser.id);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{
    phone?: string;
    isActive: boolean;
  }>({
    values: user.data
      ? { phone: user.data.phone ?? "", isActive: user.data.isActive }
      : undefined,
  });

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await update.mutateAsync({
        phone: values.phone || null,
        isActive: values.isActive,
      });
      navigate("/users", { replace: true });
    } catch (error) {
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  if (user.isLoading) return <UsersPage><LoadingRows /></UsersPage>;
  if (user.isError) {
    const error = getUserError(user.error, t("users.loadError"));
    return (
      <UsersPage>
        <StatePanel>{error.status === 404 ? t("users.notFound") : getLocalizedUserError(user.error, t("users.loadError"), t)}</StatePanel>
      </UsersPage>
    );
  }

  const pending = isSubmitting || update.isPending;

  return (
    <UsersPage>
      <div className="space-y-6">
        <PageHeader
          title={<>{t("users.editTitle")}{isSelf && <YouBadge />}</>}
          description={t("users.editDescription")}
        />
        <form className="max-w-3xl rounded-xl border border-border bg-surface shadow-subtle" onSubmit={submit} noValidate>
          <div className="space-y-5 p-5 sm:p-6">
            {apiError && <p className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground" role="alert">{apiError}</p>}

            <Field id="user-name" label={t("users.fieldName")}>
              <input
                id="user-name"
                className="input bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
                dir="auto"
                readOnly
                disabled
                value={user.data?.name ?? ""}
              />
            </Field>

            <Field id="user-email" label={t("users.fieldEmail")}>
              <input
                id="user-email"
                type="email"
                className="input bg-surface-muted/50 text-muted-foreground cursor-not-allowed text-start"
                dir="ltr"
                readOnly
                disabled
                value={user.data?.email ?? ""}
              />
            </Field>

            <Field id="user-role" label={t("users.fieldRole")}>
              <input
                id="user-role"
                className="input bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
                readOnly
                disabled
                value={user.data?.role ? t(`users.roles.${user.data.role}`) : ""}
              />
            </Field>

            <Field id="user-phone" label={t("users.fieldPhone")} error={errors.phone?.message ? t(errors.phone.message) : undefined}>
              <input
                id="user-phone"
                type="tel"
                className="input text-start"
                dir="ltr"
                autoComplete="tel"
                {...register("phone")}
              />
            </Field>

            <div className="rounded-lg border border-border bg-surface-subtle/50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary/30" disabled={isSelf} {...register("isActive")} />
                <span>
                  <span className="block text-sm font-medium text-foreground">{t("users.fieldActive")}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {isSelf ? t("users.selfDeactivateBlocked") : t("users.activeHelp")}
                  </span>
                </span>
              </label>
            </div>
          </div>
          <FormFooter pending={pending} />
        </form>
      </div>
    </UsersPage>
  );
}

function FormFooter({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-subtle/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 rounded-b-xl">
      <Link className="button-secondary text-center" to="/users">{t("common.cancel")}</Link>
      <button className="button-link" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
    </div>
  );
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>
        {label}
        {required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
