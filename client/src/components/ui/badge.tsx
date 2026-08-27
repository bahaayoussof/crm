import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "progress"
    | "neutral";
  size?: "sm" | "default";
}

const badgeVariants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "border-border bg-surface-secondary text-foreground",
  secondary: "border-border bg-surface-secondary text-muted-foreground",
  outline: "border-border bg-transparent text-foreground",
  success: "border-transparent bg-success-soft text-success-foreground",
  warning: "border-transparent bg-warning-soft text-warning-foreground",
  danger: "border-transparent bg-danger-soft text-danger-foreground",
  info: "border-transparent bg-info-soft text-info-foreground",
  progress: "border-transparent bg-progress-soft text-progress-foreground",
  neutral: "border-border bg-surface-secondary text-muted-foreground",
};

const badgeSizes: Record<NonNullable<BadgeProps["size"]>, string> = {
  default: "px-2 py-0.5 text-xs font-medium",
  sm: "px-1.5 py-0.2 text-[0.6875rem] font-medium leading-none",
};

export function Badge({
  className,
  variant = "default",
  size = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border transition-colors",
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    />
  );
}
