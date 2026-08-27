import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface DataTableEmptyRowProps {
  colSpan: number;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function DataTableEmptyRow({
  colSpan,
  message,
  action,
  className,
}: DataTableEmptyRowProps) {
  const { t } = useTranslation();
  return (
    <tr>
      <td
        className={cn("px-4 py-12 text-center text-xs text-muted-foreground", className)}
        colSpan={colSpan}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <p className="text-xs text-muted-foreground">{message ?? t("common.noData", "No data found")}</p>
          {action && <div className="mt-1">{action}</div>}
        </div>
      </td>
    </tr>
  );
}

export interface DataTableEmptyCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function DataTableEmptyCard({
  title,
  description,
  action,
  icon,
  className,
}: DataTableEmptyCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-secondary/50 p-8 text-center",
        className
      )}
    >
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      {title && <h3 className="text-xs font-semibold text-foreground">{title}</h3>}
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export const DataTableEmptyState = DataTableEmptyCard;
