import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export function CustomerPage({ children }: PropsWithChildren) {
  return <main className="page-container">{children}</main>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <div className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</div>}</div>{actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}</header>;
}

export function StatePanel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="border-y border-dashed bg-white/50 px-5 py-10 text-center text-sm leading-6 text-muted-foreground"><p>{children}</p>{action && <div className="mt-4 flex justify-center">{action}</div>}</div>;
}

export function LoadingRows() {
  const { t } = useTranslation();
  return <div aria-label={t("common.loading")} className="overflow-hidden rounded-md border bg-white"><div className="h-10 animate-pulse border-b bg-muted/80" /><div className="divide-y">{Array.from({ length: 5 }, (_, index) => <div className="flex h-14 items-center gap-5 px-4" key={index}><div className="h-3 w-1/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /><div className="ms-auto h-3 w-20 animate-pulse rounded bg-muted" /></div>)}</div></div>;
}
