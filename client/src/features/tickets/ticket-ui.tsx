export function TicketPage({ children }: { children: React.ReactNode }) {
  return <main className="page-container">{children}</main>;
}

export function TicketPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

export function TicketState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface px-5 py-12 text-center shadow-subtle">
      <p className="text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}

export function TicketSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border border-table-border bg-table-background p-4 shadow-subtle"
      aria-label="loading"
    >
      <div className="h-10 animate-pulse rounded-lg bg-muted/70" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="h-12 animate-pulse rounded-lg bg-muted/40" key={index} />
      ))}
    </div>
  );
}
