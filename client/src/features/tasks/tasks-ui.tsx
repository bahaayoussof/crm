import type { PropsWithChildren, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader as SharedPageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "./task.types";

export function TasksPage({ children }: PropsWithChildren) {
  return <main className="page-container">{children}</main>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return <SharedPageHeader title={title} description={description} actions={actions} />;
}

export function StatePanel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center shadow-2xs">
      <p className="text-sm text-muted-foreground">{children}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingRows() {
  const { t } = useTranslation();
  return (
    <div
      aria-label={t("common.loading")}
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle"
    >
      <div className="h-10 animate-pulse border-b border-border bg-surface-subtle" />
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="flex h-14 items-center gap-5 px-4" key={index}>
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="ms-auto h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<TaskStatus, string> = {
  OPEN: "border-border bg-surface-subtle text-foreground/80",
  DONE: "border-success/20 bg-success-soft text-success-foreground",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {t(`tasks.status.${status}`)}
    </span>
  );
}

export function OverdueBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-full border border-danger/20 bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-foreground">
      {t("tasks.overdue")}
    </span>
  );
}
