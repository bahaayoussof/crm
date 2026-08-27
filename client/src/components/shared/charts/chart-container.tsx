import React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface ChartContainerProps {
  children: React.ReactElement;
  className?: string;
  height?: number | string;
  minHeight?: number | string;
  aspectRatio?: number;
  label?: string;
  testId?: string;
}

export function ChartContainer({
  children,
  className,
  height = "100%",
  minHeight,
  aspectRatio,
  label,
  testId,
}: ChartContainerProps) {
  return (
    <div
      role="region"
      aria-label={label}
      data-testid={testId}
      className={cn("w-full overflow-hidden text-xs", className)}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        aspectRatio,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
