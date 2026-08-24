import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./auth-state";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { getRoleHome } from "./auth-routing";
import { registrationSchema, type RegistrationValues } from "./auth.schemas";
import { AuthLayout } from "@/app/layouts/auth-layout";

export function RegisterPage() {
  const { t } = useTranslation();
  const { user, register: registerCustomer } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegistrationValues>({ resolver: zodResolver(registrationSchema), defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" } });
  if (user) return <Navigate to={getRoleHome(user.role)} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try { const authenticatedUser = await registerCustomer(values); navigate(getRoleHome(authenticatedUser.role), { replace: true }); }
    catch (error) { setApiError(getAuthErrorMessage(error, t)); }
  });

  return <AuthLayout title={t("auth.registerTitle")} description={t("auth.registerDescription")}>
    <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
      {apiError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
      <AuthField id="register-name" label={t("auth.name")} error={errors.name?.message ? t(errors.name.message) : undefined}><input id="register-name" className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "register-name-error" : undefined} {...register("name")} /></AuthField>
      <AuthField id="register-email" label={t("auth.email")} error={errors.email?.message ? t(errors.email.message) : undefined}><input id="register-email" className="input text-start" dir="ltr" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "register-email-error" : undefined} {...register("email")} /></AuthField>
      <AuthField id="register-phone" label={t("auth.phoneOptional")} error={errors.phone?.message ? t(errors.phone.message) : undefined}><input id="register-phone" className="input text-start" dir="ltr" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "register-phone-error" : undefined} {...register("phone")} /></AuthField>
      <AuthField id="register-password" label={t("auth.password")} error={errors.password?.message ? t(errors.password.message) : undefined}><div className="relative"><input id="register-password" className="input pe-16 text-start" dir="ltr" type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "register-password-error" : undefined} {...register("password")} /><button className="absolute inset-y-0 end-1 my-1 min-h-8 rounded px-2.5 text-xs font-medium text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t("auth.hide") : t("auth.show")}</button></div></AuthField>
      <AuthField id="register-confirm-password" label={t("auth.confirmPassword")} error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}><input id="register-confirm-password" className="input text-start" dir="ltr" type={showPassword ? "text" : "password"} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined} {...register("confirmPassword")} /></AuthField>
      <button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}</button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{t("auth.haveAccount")} <Link className="font-medium text-primary" to="/login">{t("auth.signIn")}</Link></p>
  </AuthLayout>;
}
