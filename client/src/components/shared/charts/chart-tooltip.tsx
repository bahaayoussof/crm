import React from "react";
import { cn } from "@/lib/utils";

export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
  unit?: string;
}

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (label: string | number, payload: ChartTooltipPayloadItem[]) => React.ReactNode;
  formatter?: (
    value: number | string,
    name: string,
    item: ChartTooltipPayloadItem,
    index: number,
    payload: ChartTooltipPayloadItem[]
  ) => [React.ReactNode, React.ReactNode] | React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "dot" | "line";
  className?: string;
  nameKey?: string;
  labelClassName?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
  hideLabel = false,
  hideIndicator = false,
  indicator = "dot",
  className,
  nameKey,
  labelClassName,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const renderLabel = () => {
    if (hideLabel) return null;
    const labelContent = labelFormatter ? labelFormatter(label ?? "", payload) : label;
    if (!labelContent) return null;
    return (
      <div className={cn("font-medium text-foreground", labelClassName)}>
        {labelContent}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "min-w-[8rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-flyout transition-all animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      {renderLabel()}
      <div className={cn("grid gap-1.5", !hideLabel && label && "mt-1.5")}>
        {payload.map((item, index) => {
          const key = `${item.dataKey || item.name || index}`;
          const color = item.color || item.fill || "var(--chart-1)";
          const itemPayload = item.payload ?? {};
          const itemName = nameKey && itemPayload[nameKey] ? String(itemPayload[nameKey]) : item.name || item.dataKey || "";

          let formattedValue: React.ReactNode = item.value;
          let formattedName: React.ReactNode = itemName;

          if (formatter && item.value !== undefined) {
            const formatted = formatter(item.value, String(itemName), item, index, payload);
            if (Array.isArray(formatted)) {
              formattedValue = formatted[0];
              formattedName = formatted[1] ?? formattedName;
            } else {
              formattedValue = formatted;
            }
          }

          return (
            <div key={key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                {!hideIndicator && (
                  <span
                    className={cn(
                      "shrink-0",
                      indicator === "dot" && "size-2 rounded-full",
                      indicator === "line" && "h-0.5 w-3 rounded-xs"
                    )}
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                )}
                <span className="truncate text-muted-foreground">{formattedName}</span>
              </div>
              <span className="font-semibold tabular-nums text-foreground" dir="ltr">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
