import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared ticket-form presentation shell. Owns the visual language of the
 * Internal ticket create/edit form so every role (Internal + Customer Portal)
 * composes the same card, sections, error banner, field rows and action row.
 * Presentation only — no data, permissions or copy live here.
 */

export function TicketFormShell({ className, children, ...props }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form
      noValidate
      className={cn(
        "max-w-3xl overflow-visible rounded-xl border border-border bg-surface shadow-subtle",
        className,
      )}
      {...props}
    >
      {children}
    </form>
  );
}

export function TicketFormError({ children }: { children: ReactNode }) {
  return (
    <p
      className="mx-5 mt-5 rounded-md border border-danger-subtle bg-danger-subtle/50 p-3 text-sm text-danger-foreground sm:mx-6"
      role="alert"
    >
      {children}
    </p>
  );
}

export function TicketFormSection({
  title,
  titleId,
  bordered = true,
  className,
  contentClassName = "mt-5 space-y-5",
  children,
}: {
  title: string;
  titleId: string;
  bordered?: boolean;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={titleId} className={cn(bordered && "border-t border-border", "px-5 py-6 sm:px-6", className)}>
      <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}

export function TicketFormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-subtle/50 px-5 py-4 sm:px-6 rounded-b-xl">
      {children}
    </div>
  );
}

export function TicketFormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground" htmlFor={id}>{label}</label>
      <div className="mt-2">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
