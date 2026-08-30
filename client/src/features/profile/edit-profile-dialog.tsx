import { zodResolver } from "@hookform/resolvers/zod";
import type { UseMutationResult } from "@tanstack/react-query";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PhoneInput } from "@/components/shared/phone-input";
import { AuthField } from "@/features/auth/auth-field";
import { optionalPhoneInputSchema } from "@/lib/phone";
import type { SelfProfile, SelfProfileUpdate } from "./profile.types";

const editProfileSchema = z.strictObject({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: optionalPhoneInputSchema,
});

type EditProfileValues = {
  name?: string;
  email?: string;
  phone: string;
};

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

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: SelfProfile;
  updateMutation: UseMutationResult<SelfProfile, unknown, SelfProfileUpdate>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  updateMutation,
  returnFocusRef,
}: EditProfileDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: { name: profile.name, email: profile.email, phone: profile.phone ?? "" },
  });

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      reset({ name: profile.name, email: profile.email, phone: profile.phone ?? "" });
      dialogRef.current?.focus();
      return;
    }
    updateMutation.reset();
    if (!hasOpenedRef.current) return;
    const target = returnFocusRef?.current;
    if (target && document.body.contains(target)) target.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile.name, profile.email, profile.phone, reset, returnFocusRef]);

  const close = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync({
        phone: values.phone || null,
      });
      onOpenChange(false);
    } catch (error) {
      if (errorCode(error) === "EMAIL_IN_USE") {
        setError("email", { message: "profile.errors.EMAIL_IN_USE" });
        return;
      }
      setError("root", { message: "profile.errors.updateFailed" });
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

  const rootError = errors.root?.message ? t(errors.root.message) : null;
  const dialogTitle = t("profile.editTitle");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
        onMouseDown={close}
        aria-hidden="true"
      />
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
            {dialogTitle}
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

        <form onSubmit={onSubmit} noValidate className="flex flex-col">
          <div className="flex flex-col gap-4 p-6">
            {rootError && (
              <div
                role="alert"
                className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-sm font-medium text-danger"
              >
                {rootError}
              </div>
            )}

            <AuthField
              id="ep-name"
              label={t("profile.fullName")}
            >
              <input
                id="ep-name"
                className="input bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
                autoComplete="name"
                readOnly
                {...register("name")}
              />
            </AuthField>

            <AuthField
              id="ep-email"
              label={t("profile.emailAddress")}
            >
              <input
                id="ep-email"
                className="input text-start bg-surface-muted/50 text-muted-foreground cursor-not-allowed"
                dir="ltr"
                type="email"
                autoComplete="email"
                readOnly
                {...register("email")}
              />
            </AuthField>

            <AuthField
              id="ep-phone"
              label={t("profile.phoneNumber")}
              error={errors.phone?.message ? t(errors.phone.message) : undefined}
            >
              <Controller
                name="phone"
                control={control}
                render={({ field, fieldState }) => (
                  <PhoneInput
                    id="ep-phone"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                    aria-describedby={errors.phone ? "ep-phone-error" : undefined}
                  />
                )}
              />
            </AuthField>
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-border/80 bg-surface/40 px-6 py-4">
            <button type="button" disabled={isSubmitting} onClick={close} className="button-secondary sm:w-auto">
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="button-primary inline-flex items-center gap-2 sm:w-auto"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>{isSubmitting ? t("profile.saving") : t("profile.saveChanges")}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
