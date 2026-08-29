import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUnwatchTicket, useWatchTicket } from "./collaboration-hooks";

interface WatchToggleProps {
  ticketId: string;
  watching: boolean;
  watcherCount: number;
  /** Strip variant: icon-only toggle + bare count, no full-width button. */
  compact?: boolean;
}

/**
 * Follow / unfollow the current ticket. Watchers receive in-app notifications on
 * ticket activity (new note, reply, status or assignment change). Server state is
 * authoritative — the ticket detail query is invalidated after each mutation.
 */
export function WatchToggle({ ticketId, watching, watcherCount, compact = false }: WatchToggleProps) {
  const { t } = useTranslation();
  const watch = useWatchTicket(ticketId);
  const unwatch = useUnwatchTicket(ticketId);
  const [error, setError] = useState<string | null>(null);
  const pending = watch.isPending || unwatch.isPending;

  const toggle = async () => {
    setError(null);
    try {
      await (watching ? unwatch : watch).mutateAsync();
    } catch {
      setError(t("collaboration.watchError"));
    }
  };

  const actionLabel = pending
    ? t("common.saving")
    : watching
      ? t("collaboration.watching")
      : t("collaboration.watch");

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-foreground">{watcherCount}</span>
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={watching}
            aria-label={actionLabel}
            title={actionLabel}
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
              watching
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                : "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {watching ? (
              <EyeOff className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Eye className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-danger-foreground" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-pressed={watching}
          className={cn(
            watching ? "button-secondary" : "button-primary",
            "sm:w-auto gap-2",
          )}
        >
          {watching ? (
            <EyeOff className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending
            ? t("common.saving")
            : watching
              ? t("collaboration.watching")
              : t("collaboration.watch")}
        </button>
        <span className="text-xs text-muted-foreground">
          {t("collaboration.watchers", { count: watcherCount })}
        </span>
      </div>
      {error && (
        <p className="text-sm text-danger-foreground" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
