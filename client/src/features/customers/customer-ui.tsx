import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

export function CustomerPage({ children }: PropsWithChildren) {
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between"><div><Link className="text-sm text-primary" to="/dashboard">Customer Support CRM</Link><h1 className="mt-2 text-2xl font-semibold">{title}</h1>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{actions && <div className="flex gap-2">{actions}</div>}</header>;
}

export function StatePanel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="rounded-md border border-dashed bg-white px-6 py-12 text-center text-sm text-muted-foreground"><p>{children}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function LoadingRows() {
  return <div aria-label="Loading" className="space-y-3"><div className="h-12 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /><div className="h-12 animate-pulse rounded bg-muted" /></div>;
}
