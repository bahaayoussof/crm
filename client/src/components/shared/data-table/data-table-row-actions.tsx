import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableRowActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function DataTableRowActions({ className, children, ...props }: DataTableRowActionsProps) {
  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export const ICON_ACTION_BUTTON =
  "inline-flex size-7.5 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors " +
  "hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const ICON_ACTION_DANGER =
  "inline-flex size-7.5 items-center justify-center rounded-lg border border-danger-soft text-danger transition-colors " +
  "hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";
