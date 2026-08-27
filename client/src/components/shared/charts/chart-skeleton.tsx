import React from "react";
import { cn } from "@/lib/utils";

export interface ChartSkeletonProps {
  className?: string;
  height?: number | string;
}

export function ChartSkeleton({ className, height = "14rem" }: ChartSkeletonProps) {
  return (
    <div
      className={cn("w-full animate-pulse rounded-lg bg-muted/70", className)}
      style={{ height }}
      aria-hidden="true"
    />
  );
}
