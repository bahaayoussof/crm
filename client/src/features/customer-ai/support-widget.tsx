import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SupportWidgetProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Visible + screen-reader title for the panel and its heading. */
  title: string;
  /** Accessible label for the floating launcher button. */
  launcherLabel: string;
  /** Accessible label for the close/minimize control. */
  closeLabel: string;
  /** Icon rendered inside the launcher. */
  launcherIcon: ReactNode;
  /**
   * Optional compact control shown in the header, left of the close button —
   * e.g. the Live Chat "End chat" action. It is deliberately separate from the
   * close button so a UI-only minimize is never confused with ending a session.
   */
  headerAction?: ReactNode;
  /** Panel body — conversation area + composer. Provided by the active channel. */
  children: ReactNode;
}

/**
 * Non-modal floating support surface — the reusable shell for Customer AI Chat
 * today and Customer Live Chat later. Deliberately NOT a dialog:
 *
 *  - no backdrop / overlay / page blur / pointer-blocking layer
 *  - no focus trap and nothing outside is made inert or `aria-hidden`
 *  - the underlying Portal stays fully scrollable / clickable / navigable
 *
 * Anchored to the physical bottom-right of the viewport in both LTR and RTL by
 * product decision (RTL only mirrors the content inside the panel, not the panel
 * itself). Portalled to `document.body` with `fixed` positioning so it never
 * depends on a parent container's overflow or stacking context and never shifts
 * page layout.
 *
 * The shell owns: launcher, fixed positioning + safe-area spacing, compact
 * header + close, Escape-to-close, focus the panel on open, return focus to the
 * launcher on close. It knows nothing about AI / Live Chat APIs.
 */
export function SupportWidget({ open, onOpenChange, title, launcherLabel, closeLabel, launcherIcon, headerAction, children }: SupportWidgetProps) {
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      panelRef.current?.focus();
      return;
    }
    // Only after a real open -> close cycle, and only if the launcher is still
    // mounted. Never on first render, so a page load does not move focus.
    if (!hasOpenedRef.current) return;
    const target = launcherRef.current;
    if (target && document.body.contains(target)) target.focus();
  }, [open]);

  return <>
    {!open && <button
      ref={launcherRef}
      type="button"
      aria-label={launcherLabel}
      title={launcherLabel}
      onClick={() => onOpenChange(true)}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
    >{launcherIcon}</button>}

    {open && createPortal(
      <section
        ref={panelRef}
        tabIndex={-1}
        aria-label={title}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onOpenChange(false); } }}
        className={
          "fixed z-40 flex flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl outline-none " +
          "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[calc(100dvh-1.5rem)] rounded-xl " +
          "sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px] sm:h-[680px] sm:max-h-[calc(100dvh-2rem)]"
        }
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{title}</h2>
          {headerAction}
          <button
            type="button"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={() => onOpenChange(false)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </section>,
      document.body,
    )}
  </>;
}
