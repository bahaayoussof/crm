import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-state";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { getRoleHome } from "./auth-routing";
import { loginSchema, type LoginValues } from "./auth.schemas";
import { AuthLayout } from "@/app/layouts/auth-layout";

export function LoginPage() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  if (user) return <Navigate to={getRoleHome(user.role)} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const authenticatedUser = await login(values);
      navigate(getRoleHome(authenticatedUser.role), { replace: true });
    } catch (error) {
      setApiError(getAuthErrorMessage(error, t));
    }
  });

  return (
    <AuthLayout title={t("auth.loginTitle")} description={t("auth.loginDescription")}>
      <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
        {apiError && (
          <p role="alert" className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground">
            {apiError}
          </p>
        )}
        <AuthField id="login-email" label={t("auth.email")} error={errors.email?.message ? t(errors.email.message) : undefined}>
          <input id="login-email" className="input text-start" dir="ltr" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "login-email-error" : undefined} {...register("email")} />
        </AuthField>
        <AuthField id="login-password" label={t("auth.password")} error={errors.password?.message ? t(errors.password.message) : undefined}>
          <div className="relative">
            <input id="login-password" className="input pe-16 text-start" dir="ltr" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "login-password-error" : undefined} {...register("password")} />
            <button className="absolute inset-y-0 end-1 my-1 min-h-8 rounded px-2.5 text-xs font-medium text-primary hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" type="button" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </AuthField>
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.needAccount")} <Link className="font-medium text-primary hover:underline" to="/register">{t("auth.register")}</Link>
      </p>
    </AuthLayout>
  );
}
