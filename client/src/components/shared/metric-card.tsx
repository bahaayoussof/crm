import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  trend?: React.ReactNode;
  variant?: "default" | "primary" | "warning" | "danger" | "success";
  className?: string;
}

const variantStyles: Record<NonNullable<MetricCardProps["variant"]>, { border: string; bg: string; iconBg: string; text: string }> = {
  default: {
    border: "border-border",
    bg: "bg-surface",
    iconBg: "bg-surface-subtle text-muted-foreground",
    text: "text-foreground",
  },
  primary: {
    border: "border-primary-subtle",
    bg: "bg-surface",
    iconBg: "bg-primary-subtle text-primary",
    text: "text-primary",
  },
  warning: {
    border: "border-warning-subtle",
    bg: "bg-surface",
    iconBg: "bg-warning-subtle text-warning-foreground",
    text: "text-warning-foreground",
  },
  danger: {
    border: "border-danger-subtle",
    bg: "bg-surface",
    iconBg: "bg-danger-subtle text-danger-foreground",
    text: "text-danger-foreground",
  },
  success: {
    border: "border-success-subtle",
    bg: "bg-surface",
    iconBg: "bg-success-subtle text-success-foreground",
    text: "text-success-foreground",
  },
};

export function MetricCard({
  label,
  value,
  icon,
  trend,
  variant = "default",
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-lg border p-4 shadow-subtle transition-all",
        styles.border,
        styles.bg,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {icon && (
          <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-xs", styles.iconBg)}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className={cn("text-2xl font-bold tracking-tight tabular-nums", styles.text)} dir="ltr">
          {value}
        </p>
        {trend && <div className="text-xs font-medium">{trend}</div>}
      </div>
    </div>
  );
}
