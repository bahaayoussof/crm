import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Consistent section title for the dashboard: heading + optional count badge, with
 * an optional right-aligned action slot (e.g. a "View all tickets" link).
 */
export function DashboardSectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {count != null && count > 0 && (
          <Badge variant="secondary" size="sm">
            {count}
          </Badge>
        )}
      </div>
      {action}
    </div>
  );
}
