import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function FilterBar({ className, children, ...props }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
