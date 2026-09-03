import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { PasswordInput } from "@/components/shared/password-input";
import { PhoneInput } from "@/components/shared/phone-input";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { getRoleHome } from "./auth-routing";
import { useAuth } from "./auth-state";
import { registrationSchema, type RegistrationValues } from "./auth.schemas";

export function RegisterPage() {
  const { t } = useTranslation();
  const { user, register: registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema), defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" } });
  if (user) return <Navigate to={getRoleHome(user.role)} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const authenticatedUser = await registerCustomer(values);
      navigate(getRoleHome(authenticatedUser.role), { replace: true });
    } catch (error) {
      setApiError(getAuthErrorMessage(error, t));
    }
  });

  return (
    <AuthLayout title={t("auth.registerTitle")} description={t("auth.registerDescription")}>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        {apiError && (
          <p role="alert" className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground">
            {apiError}
          </p>
        )}
        <AuthField id="register-name" label={t("auth.name")} error={errors.name?.message ? t(errors.name.message) : undefined}>
          <input id="register-name" className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "register-name-error" : undefined} {...register("name")} />
        </AuthField>
        <AuthField id="register-email" label={t("auth.email")} error={errors.email?.message ? t(errors.email.message) : undefined}>
          <input id="register-email" className="input text-start" dir="ltr" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "register-email-error" : undefined} {...register("email")} />
        </AuthField>
        <AuthField id="register-phone" label={t("auth.phoneOptional")} error={errors.phone?.message ? t(errors.phone.message) : undefined}>
          <Controller
            name="phone"
            control={control}
            render={({ field, fieldState }) => (
              <PhoneInput
                id="register-phone"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
                aria-describedby={errors.phone ? "register-phone-error" : undefined}
              />
            )}
          />
        </AuthField>
        <AuthField id="register-password" label={t("auth.password")} error={errors.password?.message ? t(errors.password.message) : undefined}>
          <PasswordInput id="register-password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "register-password-error" : "register-password-help"} {...register("password")} />
        </AuthField>
        <AuthField id="register-confirm-password" label={t("auth.confirmPassword")} error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}>
          <PasswordInput id="register-confirm-password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined} {...register("confirmPassword")} />
        </AuthField>
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.haveAccount")} <Link className="font-medium text-primary hover:underline" to="/login">{t("auth.signIn")}</Link>
      </p>
    </AuthLayout>
  );
}
