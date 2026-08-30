import { initialsOf } from "@/lib/initials";
import { cn } from "@/lib/utils";

/** Initials-only avatar. No image upload system exists, so no photo / edit pencil. */
export function ProfileAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-16 shrink-0 select-none items-center justify-center rounded-full border border-border bg-surface-subtle text-lg font-semibold text-foreground sm:size-20",
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}
