import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-state";
import { getLocalizedUserError, getUserError } from "./user-error";
import { useCreateUser, useUpdateUser, useUser } from "./user-hooks";
import { userCreateFormSchema, userEditFormSchema, type UserCreateFormValues, type UserEditFormValues } from "./user.schemas";
import { LoadingRows, NativeSelect, PageHeader, StatePanel, UsersPage, YouBadge } from "./users-ui";
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

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UserCreateFormValues>({
    resolver: zodResolver(userCreateFormSchema),
    defaultValues: { name: "", email: "", password: "", role: "AGENT" },
  });

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

  return <UsersPage>
    <PageHeader title={t("users.createTitle")} description={t("users.formDescription")} />
    <form className="mt-6 max-w-3xl rounded-md border bg-white" onSubmit={submit} noValidate>
      <div className="space-y-5 p-5 sm:p-6">
        {apiError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{apiError}</p>}

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

        <Field id="user-role" label={t("users.fieldRole")} required error={errors.role?.message ? t(errors.role.message) : undefined}>
          <NativeSelect id="user-role" aria-invalid={Boolean(errors.role)} {...register("role")}>
            {MANAGEABLE_ROLES.map((option) => <option key={option} value={option}>{t(`users.roles.${option}`)}</option>)}
          </NativeSelect>
        </Field>
      </div>
      <FormFooter pending={pending} />
    </form>
  </UsersPage>;
}

function EditUserForm({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const user = useUser(id);
  const update = useUpdateUser(id);
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const isSelf = Boolean(user.data && currentUser && user.data.id === currentUser.id);

  const { register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditFormSchema),
    defaultValues: { name: "", email: "", role: "AGENT", isActive: true },
  });

  useEffect(() => {
    if (user.data) reset({ name: user.data.name, email: user.data.email, role: user.data.role, isActive: user.data.isActive });
  }, [user.data, reset]);

  const submit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await update.mutateAsync(values);
      navigate("/users", { replace: true });
    } catch (error) {
      setApiError(getLocalizedUserError(error, t("users.saveError"), t));
    }
  });

  if (user.isLoading) return <UsersPage><LoadingRows /></UsersPage>;
  if (user.isError) {
    const error = getUserError(user.error, t("users.loadError"));
    return <UsersPage>
      <StatePanel>{error.status === 404 ? t("users.notFound") : getLocalizedUserError(user.error, t("users.loadError"), t)}</StatePanel>
    </UsersPage>;
  }

  const pending = isSubmitting || update.isPending;

  return <UsersPage>
    <PageHeader
      title={<>{t("users.editTitle")}{isSelf && <YouBadge />}</>}
      description={t("users.editDescription")}
    />
    <form className="mt-6 max-w-3xl rounded-md border bg-white" onSubmit={submit} noValidate>
      <div className="space-y-5 p-5 sm:p-6">
        {apiError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{apiError}</p>}

        <Field id="user-name" label={t("users.fieldName")} required error={errors.name?.message ? t(errors.name.message) : undefined}>
          <input id="user-name" className="input" dir="auto" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "user-name-error" : undefined} {...register("name")} />
        </Field>

        <Field id="user-email" label={t("users.fieldEmail")} required error={errors.email?.message ? t(errors.email.message) : undefined}>
          <input id="user-email" type="email" className="input" dir="ltr" autoComplete="off" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "user-email-error" : undefined} {...register("email")} />
        </Field>

        <Field
          id="user-role"
          label={t("users.fieldRole")}
          required
          error={errors.role?.message ? t(errors.role.message) : undefined}
          hint={isSelf ? t("users.selfRoleReadonly") : undefined}
        >
          <NativeSelect
            id="user-role"
            disabled={isSelf}
            aria-invalid={Boolean(errors.role)}
            aria-describedby={isSelf ? "user-role-hint" : undefined}
            {...register("role")}
          >
            {MANAGEABLE_ROLES.map((option) => <option key={option} value={option}>{t(`users.roles.${option}`)}</option>)}
          </NativeSelect>
        </Field>

        <div className="rounded-md border bg-muted/20 p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4" disabled={isSelf} {...register("isActive")} />
            <span>
              <span className="block text-sm font-medium">{t("users.fieldActive")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {isSelf ? t("users.selfDeactivateBlocked") : t("users.activeHelp")}
              </span>
            </span>
          </label>
        </div>
      </div>
      <FormFooter pending={pending} />
    </form>
  </UsersPage>;
}

function FormFooter({ pending }: { pending: boolean }) {
  const { t } = useTranslation();
  return <div className="flex flex-col-reverse gap-3 border-t bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
    <Link className="button-secondary text-center" to="/users">{t("common.cancel")}</Link>
    <button className="button-link" type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</button>
  </div>;
}

function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium" htmlFor={id}>{label}{required && <span className="text-red-600" aria-hidden="true"> *</span>}</label>
    <div className="mt-2">{children}</div>
    {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-red-700">{error}</p>}
  </div>;
}
