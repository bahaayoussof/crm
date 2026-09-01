import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Generic loading placeholder. Deliberately unopinionated about size — the
 * caller sets width/height/shape via `className` so this can back table rows,
 * cards, avatars, text lines, chart areas, etc.
 *
 * Uses the theme `bg-muted` token so it works in light and dark without
 * per-call colour overrides.
 */
export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** A horizontal run of text-line skeletons — handy inside cards / detail panes. */
export interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineClassName?: string;
}

export function SkeletonText({ lines = 3, className, lineClassName }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            "h-3.5",
            index === lines - 1 ? "w-2/3" : "w-full",
            lineClassName
          )}
        />
      ))}
    </div>
  );
}
