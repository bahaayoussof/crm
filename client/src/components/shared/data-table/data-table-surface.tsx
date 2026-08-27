import * as React from "react";
import { cn } from "@/lib/utils";

export interface DataTableSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const DataTableSurface = React.forwardRef<HTMLDivElement, DataTableSurfaceProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-table-border bg-table-background shadow-xs overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DataTableSurface.displayName = "DataTableSurface";
