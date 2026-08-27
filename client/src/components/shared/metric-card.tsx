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
    bg: "bg-card",
    iconBg: "bg-surface-secondary text-muted-foreground",
    text: "text-card-foreground",
  },
  primary: {
    border: "border-border",
    bg: "bg-card",
    iconBg: "bg-surface-secondary text-foreground",
    text: "text-card-foreground",
  },
  warning: {
    border: "border-warning-soft",
    bg: "bg-card",
    iconBg: "bg-warning-soft text-warning-foreground",
    text: "text-warning-foreground",
  },
  danger: {
    border: "border-danger-soft",
    bg: "bg-card",
    iconBg: "bg-danger-soft text-danger-foreground",
    text: "text-danger-foreground",
  },
  success: {
    border: "border-success-soft",
    bg: "bg-card",
    iconBg: "bg-success-soft text-success-foreground",
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
