import React from "react";
import { cn } from "@/lib/utils";

export interface ChartLegendPayloadItem {
  value?: string;
  id?: string;
  type?: string;
  color?: string;
  dataKey?: string | number;
  inactive?: boolean;
}

export interface ChartLegendContentProps {
  payload?: ChartLegendPayloadItem[];
  className?: string;
  hideIcon?: boolean;
  nameKey?: string;
}

export function ChartLegendContent({
  payload,
  className,
  hideIcon = false,
}: ChartLegendContentProps) {
  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-4 text-xs", className)}>
      {payload.map((item, index) => {
        const color = item.color || "var(--chart-1)";
        return (
          <div
            key={item.id ?? index}
            className={cn(
              "flex items-center gap-1.5 transition-opacity",
              item.inactive && "opacity-40"
            )}
          >
            {!hideIcon && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            )}
            <span className="font-medium text-foreground">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}
