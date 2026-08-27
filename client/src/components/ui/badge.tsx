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
  success: "border-success/20 bg-success-soft text-success-foreground",
  warning: "border-warning/20 bg-warning-soft text-warning-foreground",
  danger: "border-danger/20 bg-danger-soft text-danger-foreground",
  info: "border-info/20 bg-info-soft text-info-foreground",
  progress: "border-progress/20 bg-progress-soft text-progress-foreground",
  neutral: "border-border/80 bg-surface-secondary text-muted-foreground",
};

const badgeSizes: Record<NonNullable<BadgeProps["size"]>, string> = {
  default: "px-2 py-0.5 text-[10px] font-medium h-5 rounded-md leading-none",
  sm: "px-1.5 py-0.5 text-[9px] font-medium rounded leading-none",
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
        "inline-flex items-center justify-center gap-1 border transition-colors select-none",
        badgeVariants[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    />
  );
}
