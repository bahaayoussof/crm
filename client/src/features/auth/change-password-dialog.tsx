import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { changePasswordRequest } from "./auth-api";
import { getAuthErrorMessage } from "./auth-error";
import { AuthField } from "./auth-field";
import { setAuthToken } from "./auth-token";
import { AUTH_QUERY_KEY } from "./auth-state";
import { changePasswordSchema, type ChangePasswordValues } from "./auth.schemas";

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function errorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? (error.response?.data?.error?.code as string | undefined) : undefined;
}

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function ChangePasswordDialog({ open, onOpenChange, returnFocusRef }: ChangePasswordDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      dialogRef.current?.focus();
      return;
    }
    reset();
    setApiError(null);
    setDone(false);
    setShowPassword(false);
    if (!hasOpenedRef.current) return;
    const target = returnFocusRef?.current;
    if (target && document.body.contains(target)) target.focus();
  }, [open, reset, returnFocusRef]);

  const close = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = handleSubmit(async (values) => {
    setApiError(null);
    try {
      const result = await changePasswordRequest(values);
      setAuthToken(result.token);
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
      setDone(true);
    } catch (error) {
      const code = errorCode(error);
      if (code === "INVALID_PASSWORD") {
        setError("currentPassword", { message: t("errors.auth.INVALID_PASSWORD") });
        return;
      }
      if (code === "SAME_PASSWORD") {
        setError("newPassword", { message: t("errors.auth.SAME_PASSWORD") });
        return;
      }
      setApiError(getAuthErrorMessage(error, t));
    }
  });

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const items = focusables(dialogRef.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200" onMouseDown={close} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative z-10 my-auto flex w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl outline-none animate-in zoom-in-95 duration-200"
      >
        <header className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {t("auth.changePassword.title")}
          </h2>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={close}
            aria-label={t("common.close")}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        {done ? (
          <div className="flex flex-col gap-4 p-6">
            <p role="status" className="rounded-lg border border-border bg-surface-subtle p-3 text-sm text-foreground">
              {t("auth.changePassword.success")}
            </p>
            <div className="flex justify-end">
              <button type="button" className="button-primary sm:w-auto" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col">
            <div className="flex flex-col gap-4 p-6">
              {apiError && (
                <div role="alert" className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-sm font-medium text-danger">
                  {apiError}
                </div>
              )}
              <AuthField
                id="cp-current"
                label={t("auth.changePassword.currentPassword")}
                error={errors.currentPassword?.message ? t(errors.currentPassword.message) : undefined}
              >
                <input
                  id="cp-current"
                  className="input text-start"
                  dir="ltr"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.currentPassword)}
                  {...register("currentPassword")}
                />
              </AuthField>
              <AuthField
                id="cp-new"
                label={t("auth.changePassword.newPassword")}
                error={errors.newPassword?.message ? t(errors.newPassword.message) : undefined}
              >
                <div className="relative">
                  <input
                    id="cp-new"
                    className="input pe-16 text-start"
                    dir="ltr"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.newPassword)}
                    {...register("newPassword")}
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
                id="cp-confirm"
                label={t("auth.changePassword.confirmPassword")}
                error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
              >
                <input
                  id="cp-confirm"
                  className="input text-start"
                  dir="ltr"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register("confirmPassword")}
                />
              </AuthField>
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-border/80 bg-surface/40 px-6 py-4">
              <button type="button" disabled={isSubmitting} onClick={close} className="button-secondary sm:w-auto">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={isSubmitting} className="button-primary inline-flex items-center gap-2 sm:w-auto">
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                <span>{isSubmitting ? t("auth.changePassword.submitting") : t("auth.changePassword.submit")}</span>
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
