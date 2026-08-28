import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/shared/charts";

/**
 * Level-2 grouping. Deliberately has NO border or background — hierarchy comes
 * from the heading treatment and the spacing rhythm, not another card outline.
 */
export function ReportSection({
  title,
  description,
  action,
  children,
  className,
  labelledBy,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section className={cn("space-y-3.5", className)} aria-labelledby={labelledBy}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2
            id={labelledBy}
            className="text-base font-semibold tracking-tight text-foreground"
          >
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Level-3 widget container. Exactly one border deep — never nest another bordered
 * box inside it; use separators and spacing instead.
 */
export function ReportPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card p-4 shadow-subtle sm:p-5",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(title || action ? "mt-4" : undefined, "flex-1", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}

export function SectionError({ onRetry, loading }: { onRetry: () => void; loading?: boolean }) {
  const { t } = useTranslation();
  if (loading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span>{t("reports.sectionError")}</span>
      <button className="button-secondary" onClick={onRetry}>
        {t("common.retry")}
      </button>
    </div>
  );
}

export function InlineState({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center shadow-subtle">
      <p className="text-sm text-muted-foreground">{text}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="space-y-10">
      <div className="h-9 w-full max-w-md animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <ChartSkeleton height={384} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
        <div className="h-80 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
