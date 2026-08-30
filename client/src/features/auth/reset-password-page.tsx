import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { resetPasswordRequest } from "./auth-api";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { resetPasswordSchema, type ResetPasswordValues } from "./auth.schemas";

const INVALID_TOKEN_CODES = new Set(["TOKEN_INVALID", "TOKEN_EXPIRED"]);

function errorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? (error.response?.data?.error?.code as string | undefined) : undefined;
}

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "invalid">(token ? "form" : "invalid");
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await resetPasswordRequest({ token, password: values.password, confirmPassword: values.confirmPassword });
      setStatus("success");
    } catch (error) {
      const code = errorCode(error);
      if (code && INVALID_TOKEN_CODES.has(code)) {
        setStatus("invalid");
        return;
      }
      setApiError(getAuthErrorMessage(error, t));
    }
  });

  if (status === "invalid") {
    return (
      <AuthLayout title={t("auth.resetPassword.title")} description={t("auth.resetPassword.description")}>
        <div className="mt-6 space-y-5">
          <p role="alert" className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground">
            {t("auth.resetPassword.invalidLink")}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link className="button-primary sm:w-auto" to="/forgot-password">
              {t("auth.resetPassword.requestNewLink")}
            </Link>
            <Link className="button-secondary sm:w-auto" to="/login">
              {t("auth.resetPassword.backToLogin")}
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (status === "success") {
    return (
      <AuthLayout title={t("auth.resetPassword.title")} description={t("auth.resetPassword.description")}>
        <div className="mt-6 space-y-5">
          <p role="status" className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-foreground">
            {t("auth.resetPassword.success")}
          </p>
          <Link className="button-primary sm:w-auto" to="/login">
            {t("auth.resetPassword.goToLogin")}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.resetPassword.title")} description={t("auth.resetPassword.description")}>
      <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
        {apiError && (
          <p role="alert" className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground">
            {apiError}
          </p>
        )}
        <AuthField
          id="reset-password"
          label={t("auth.resetPassword.newPassword")}
          error={errors.password?.message ? t(errors.password.message) : undefined}
        >
          <div className="relative">
            <input
              id="reset-password"
              className="input pe-16 text-start"
              dir="ltr"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "reset-password-error" : undefined}
              {...register("password")}
            />
            <button
              className="absolute inset-y-0 end-1 my-1 min-h-8 rounded px-2.5 text-xs font-medium text-primary hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? t("auth.hide") : t("auth.show")}
            </button>
          </div>
        </AuthField>
        <AuthField
          id="reset-confirm-password"
          label={t("auth.resetPassword.confirmPassword")}
          error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
        >
          <input
            id="reset-confirm-password"
            className="input text-start"
            dir="ltr"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "reset-confirm-password-error" : undefined}
            {...register("confirmPassword")}
          />
        </AuthField>
        <button className="button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link className="font-medium text-primary hover:underline" to="/login">
          {t("auth.resetPassword.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
