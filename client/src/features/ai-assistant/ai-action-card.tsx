import type { ComponentType } from "react";
import { Loader2 } from "lucide-react";

/**
 * One launcher card in the AI Assistant 2×2 action grid. Presentation only — it
 * just calls `onClick` (which runs the action's mutation). While the action is
 * pending it stays the same size, is disabled, and shows a spinner + the
 * existing loading phrase; its accessible name becomes that phrase so the idle
 * trigger is no longer exposed.
 *
 * The supporting description is `aria-hidden` so it never leaks into the
 * button's accessible name — the name is always the action title (or the
 * pending phrase).
 */
export function AiActionCard({
  icon: Icon,
  title,
  description,
  pending,
  pendingLabel,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  pending: boolean;
  pendingLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex min-h-[104px] w-full flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 text-start transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : (
        <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
        {pending ? pendingLabel : title}
      </span>
      {!pending && (
        <span
          className="text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]"
          aria-hidden="true"
        >
          {description}
        </span>
      )}
    </button>
  );
}
