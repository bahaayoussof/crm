import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { AuthField } from "@/features/auth/auth-field";
import type { PortalProfile } from "./profile.api";
import { useUpdatePortalProfile } from "./profile.queries";

const editProfileSchema = z.strictObject({
  name: z.string().trim().min(2, "validation.nameMin").max(100),
  email: z.string().trim().email("validation.email"),
  phone: z.string().trim().max(30, "validation.phoneMax"),
});
type EditProfileValues = z.input<typeof editProfileSchema>;

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
  profile: PortalProfile;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export function EditProfileDialog({ open, onOpenChange, profile, returnFocusRef }: EditProfileDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);
  const mutation = useUpdatePortalProfile();

  const {
    register,
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
    mutation.reset();
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
      await mutation.mutateAsync({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim() ? values.phone.trim() : null,
      });
      onOpenChange(false);
    } catch (error) {
      if (errorCode(error) === "EMAIL_IN_USE") {
        setError("email", { message: "portal.profile.errors.EMAIL_IN_USE" });
        return;
      }
      setError("root", { message: "portal.profile.errors.updateFailed" });
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
            {t("portal.profile.editTitle")}
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
              <div role="alert" className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-sm font-medium text-danger">
                {rootError}
              </div>
            )}
            <AuthField id="ep-name" label={t("portal.profile.name")} error={errors.name?.message ? t(errors.name.message) : undefined}>
              <input id="ep-name" className="input" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            </AuthField>
            <AuthField id="ep-email" label={t("portal.profile.email")} error={errors.email?.message ? t(errors.email.message) : undefined}>
              <input id="ep-email" className="input text-start" dir="ltr" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
            </AuthField>
            <AuthField id="ep-phone" label={t("portal.profile.phone")} error={errors.phone?.message ? t(errors.phone.message) : undefined}>
              <input id="ep-phone" className="input text-start" dir="ltr" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} {...register("phone")} />
            </AuthField>
          </div>
          <footer className="flex items-center justify-end gap-3 border-t border-border/80 bg-surface/40 px-6 py-4">
            <button type="button" disabled={isSubmitting} onClick={close} className="button-secondary sm:w-auto">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={isSubmitting} className="button-primary inline-flex items-center gap-2 sm:w-auto">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              <span>{isSubmitting ? t("portal.profile.saving") : t("portal.profile.saveChanges")}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
