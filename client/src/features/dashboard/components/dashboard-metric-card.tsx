import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type DashboardMetricTone = "neutral" | "warning" | "danger" | "success" | "primary";

/**
 * Compact operational KPI. Neutral by default; warning/danger tones only assert
 * themselves (soft tint + status dot) when the value is non-zero, so a healthy
 * board stays visually calm.
 */
export function DashboardMetricCard({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number;
  tone?: DashboardMetricTone;
  icon?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const formatted = new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US").format(value);
  const alert = value > 0 && (tone === "danger" || tone === "warning");

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-2 rounded-lg border bg-card p-3.5 shadow-subtle",
        alert && tone === "danger" && "border-danger-soft bg-danger-soft/20",
        alert && tone === "warning" && "border-warning-soft bg-warning-soft/20",
        !alert && "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
          {label}
        </p>
        {alert ? (
          <span
            className={cn(
              "flex size-1.5 shrink-0 rounded-full",
              tone === "danger" ? "bg-danger" : "bg-warning",
            )}
            aria-hidden="true"
          />
        ) : (
          icon && <span className="shrink-0 text-muted-foreground/70">{icon}</span>
        )}
      </div>
      <p
        className={cn(
          "text-2xl font-bold tracking-tight tabular-nums",
          alert && tone === "danger" ? "text-danger-foreground" : "text-card-foreground",
        )}
        dir="ltr"
      >
        {formatted}
      </p>
    </div>
  );
}
