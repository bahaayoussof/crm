import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/app/layouts/auth-layout";
import { forgotPasswordRequest } from "./auth-api";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { forgotPasswordSchema, type ForgotPasswordValues } from "./auth.schemas";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      await forgotPasswordRequest(values);
      setSubmitted(true);
    } catch (error) {
      setApiError(getAuthErrorMessage(error, t));
    }
  });

  return (
    <AuthLayout title={t("auth.forgotPassword.title")} description={t("auth.forgotPassword.description")}>
      {submitted ? (
        <div className="mt-6 space-y-5">
          <p role="status" className="rounded-md border border-border bg-surface-subtle p-3 text-sm text-foreground">
            {t("auth.forgotPassword.genericSuccess")}
          </p>
          <Link className="button-secondary" to="/login">
            {t("auth.forgotPassword.backToLogin")}
          </Link>
        </div>
      ) : (
        <>
          <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
            {apiError && (
              <p role="alert" className="rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground">
                {apiError}
              </p>
            )}
            <AuthField
              id="forgot-email"
              label={t("auth.forgotPassword.emailLabel")}
              error={errors.email?.message ? t(errors.email.message) : undefined}
            >
              <input
                id="forgot-email"
                className="input text-start"
                dir="ltr"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "forgot-email-error" : undefined}
                {...register("email")}
              />
            </AuthField>
            <button className="button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.submit")}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link className="font-medium text-primary hover:underline" to="/login">
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
