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
    catch (error) { setApiError(getAuthErrorMessage(error)); }
  });

  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-sm">
    <h1 className="text-2xl font-semibold">{t("auth.registerTitle")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("auth.registerDescription")}</p>
    <form className="mt-8 space-y-4" onSubmit={onSubmit} noValidate>
      {apiError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{apiError}</p>}
      <AuthField label={t("auth.name")} error={errors.name?.message}><input className="input" autoComplete="name" {...register("name")} /></AuthField>
      <AuthField label={t("auth.email")} error={errors.email?.message}><input className="input" type="email" autoComplete="email" {...register("email")} /></AuthField>
      <AuthField label={t("auth.phoneOptional")} error={errors.phone?.message}><input className="input" type="tel" autoComplete="tel" {...register("phone")} /></AuthField>
      <AuthField label={t("auth.password")} error={errors.password?.message}><div className="relative"><input className="input pe-16" type={showPassword ? "text" : "password"} autoComplete="new-password" {...register("password")} /><button className="absolute end-3 top-2.5 text-sm text-primary" type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? t("auth.hide") : t("auth.show")}</button></div></AuthField>
      <AuthField label={t("auth.confirmPassword")} error={errors.confirmPassword?.message}><input className="input" type={showPassword ? "text" : "password"} autoComplete="new-password" {...register("confirmPassword")} /></AuthField>
      <button className="button-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? t("auth.creatingAccount") : t("auth.createAccount")}</button>
    </form>
    <p className="mt-6 text-center text-sm text-muted-foreground">{t("auth.haveAccount")} <Link className="font-medium text-primary" to="/login">{t("auth.signIn")}</Link></p>
  </section></main>;
}
