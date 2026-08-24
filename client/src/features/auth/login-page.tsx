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
    try { const authenticatedUser = await login(values); navigate(getRoleHome(authenticatedUser.role), { replace: true }); }
    catch (error) { setApiError(getAuthErrorMessage(error, t)); }
  });

  return <AuthFrame title={t("auth.loginTitle")} description={t("auth.loginDescription")}>
    <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
      {apiError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
      <AuthField label={t("auth.email")} error={errors.email?.message ? t(errors.email.message) : undefined}><input className="input text-start" dir="ltr" type="email" autoComplete="email" {...register("email")} /></AuthField>
      <AuthField label={t("auth.password")} error={errors.password?.message ? t(errors.password.message) : undefined}><div className="relative"><input className="input pe-16 text-start" dir="ltr" type={showPassword ? "text" : "password"} autoComplete="current-password" {...register("password")} /><button className="absolute end-3 top-2.5 text-sm text-primary" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t("auth.hide") : t("auth.show")}</button></div></AuthField>
      <button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? t("auth.signingIn") : t("auth.signIn")}</button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{t("auth.needAccount")} <Link className="font-medium text-primary" to="/register">{t("auth.register")}</Link></p>
  </AuthFrame>;
}

function AuthFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-sm"><p className="mb-3 text-sm font-medium text-primary">{t("app.title")}</p><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p>{children}</section></main>;
}
