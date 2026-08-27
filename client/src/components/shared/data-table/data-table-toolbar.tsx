import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function DataTableToolbar({
  search,
  filters,
  actions,
  className,
  children,
  ...props
}: DataTableToolbarProps) {
  if (children) {
    return (
      <div
        className={cn(
          "px-3.5 py-2.5 border-b border-table-border bg-table-background flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-3.5 py-2.5 border-b border-table-border bg-table-background flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      {search && <div>{search}</div>}
      {(filters || actions) && (
        <div className="flex flex-wrap items-center gap-2 sm:ms-auto">
          {filters}
          {actions}
        </div>
      )}
    </div>
  );
}
