import React from "react";
import { cn } from "@/lib/utils";

export interface ChartEmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  minHeight?: number | string;
}

export function ChartEmptyState({
  title,
  description,
  className,
  minHeight = "12rem",
}: ChartEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/40 p-6 text-center text-xs text-muted-foreground",
        className
      )}
      style={{ minHeight }}
    >
      {title && <p className="font-medium text-foreground">{title}</p>}
      {description && <p className={cn("text-muted-foreground", title && "mt-1")}>{description}</p>}
    </div>
  );
}
