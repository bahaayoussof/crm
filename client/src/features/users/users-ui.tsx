import { forwardRef, type PropsWithChildren, type ReactNode, type SelectHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "./user-icons";
import type { ManageableRole } from "./user.types";

export function UsersPage({ children }: PropsWithChildren) {
  return <main className="page-container">{children}</main>;
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function StatePanel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="border-y border-dashed bg-white/50 px-5 py-10 text-center text-sm leading-6 text-muted-foreground">
    <p>{children}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>;
}

export function LoadingRows() {
  const { t } = useTranslation();
  return <div aria-label={t("common.loading")} className="overflow-hidden rounded-md border bg-white">
    <div className="h-10 animate-pulse border-b bg-muted/80" />
    <div className="divide-y">{Array.from({ length: 5 }, (_, index) => <div className="flex h-14 items-center gap-5 px-4" key={index}>
      <div className="h-3 w-1/5 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      <div className="ms-auto h-3 w-16 animate-pulse rounded bg-muted" />
    </div>)}</div>
  </div>;
}

const roleStyles: Record<ManageableRole, string> = {
  ADMIN: "border-violet-200 bg-violet-50 text-violet-700",
  MANAGER: "border-blue-200 bg-blue-50 text-blue-700",
  AGENT: "border-slate-200 bg-slate-50 text-slate-700",
};

export function RoleBadge({ role }: { role: ManageableRole }) {
  const { t } = useTranslation();
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${roleStyles[role]}`}>
    {t(`users.roles.${role}`)}
  </span>;
}

export function StatusBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${active ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
    {active ? t("users.status.active") : t("users.status.inactive")}
  </span>;
}

/** Small marker for the currently signed-in user's own row / edit page. */
export function YouBadge() {
  const { t } = useTranslation();
  return <span className="inline-flex rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
    {t("users.you")}
  </span>;
}

// One consistent Select treatment for User Management: the native control with
// its platform arrow suppressed (`appearance-none`) and a single custom chevron
// pinned to the logical end. `pe-9` keeps the value clear of the icon; `end-3`
// + a non-rotated glyph place it correctly in both LTR and RTL.
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return <span className="relative block">
      <select ref={ref} className={`input appearance-none bg-none pe-9 ${className ?? ""}`} {...props}>{children}</select>
      <ChevronDownIcon className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>;
  },
);
