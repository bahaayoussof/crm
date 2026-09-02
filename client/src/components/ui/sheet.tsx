import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Screen-reader / visible title for the sheet. */
  title: string;
  /** Accessible label for the close control. */
  closeLabel: string;
  /** Focus is returned here after the sheet closes (usually the launcher). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/**
 * Responsive overlay sheet. Below `lg` it is a bottom sheet (full width, bounded
 * height, internal scroll); at `lg`+ it is a right-side drawer pinned to the
 * viewport height. It is a portalled `role="dialog"` overlay taken out of normal
 * page flow, so opening it and growing its content never changes the underlying
 * page's height or scroll position.
 *
 * The drawer stays on the physical right at `lg`+ in both LTR and RTL — the
 * product decision is "right drawer on desktop", not a direction-mirrored one.
 *
 * Owns: focus trap, Escape-to-close, focus the panel on open (never an input),
 * return focus to `returnFocusRef` on close. It does NOT auto-scroll or move
 * focus on any content change.
 */
export function Sheet({ open, onClose, title, closeLabel, returnFocusRef, className, bodyClassName, children }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      panelRef.current?.focus();
      return;
    }
    // Return focus to the launcher only after a real open→close cycle — never on
    // first mount, so the page load does not move focus.
    if (!hasOpenedRef.current) return;
    const target = returnFocusRef?.current;
    if (target && document.body.contains(target)) target.focus();
  }, [open, returnFocusRef]);

  if (!open) return null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const items = focusables(panelRef.current);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-in fade-in-0 duration-200"
        onMouseDown={onClose}
        aria-hidden="true"
      />
      {/* Physical bottom on mobile, physical right at lg+ — the desktop drawer
          stays on the right in RTL too, by product decision. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-xl border border-border bg-card text-card-foreground shadow-2xl outline-none " +
          "animate-in slide-in-from-bottom-4 duration-200 " +
          "lg:inset-x-auto lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[440px] lg:max-w-[92vw] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:slide-in-from-right-4",
          className
        )}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            aria-label={closeLabel}
            title={closeLabel}
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5", bodyClassName)}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
