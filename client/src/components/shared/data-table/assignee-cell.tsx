import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssigneeCellProps {
  name?: string | null;
  avatarUrl?: string | null;
  unassignedLabel?: string;
  className?: string;
}

export function AssigneeCell({
  name,
  avatarUrl,
  unassignedLabel = "Unassigned",
  className,
}: AssigneeCellProps) {
  if (!name) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground", className)}>
        <span
          className="size-[18px] shrink-0 rounded-full border border-dashed border-border/80 bg-muted/40 text-muted-foreground flex items-center justify-center"
          aria-hidden="true"
        >
          <User className="size-2.5 text-muted-foreground/70" />
        </span>
        <span className="truncate">{unassignedLabel}</span>
      </div>
    );
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="size-[18px] shrink-0 rounded-full object-cover border border-border/80"
        />
      ) : (
        <span
          className="size-[18px] shrink-0 rounded-full bg-surface-secondary text-[9px] font-semibold text-foreground flex items-center justify-center border border-border/80 shadow-2xs"
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
      <span className="truncate text-[11px] font-medium text-foreground" title={name}>
        {name}
      </span>
    </div>
  );
}
