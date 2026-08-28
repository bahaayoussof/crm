import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/**
 * Shared anchored floating-layer primitive.
 *
 * Owns the mechanics that let a portalled popover escape an ancestor's overflow
 * clipping while staying visually pinned to its trigger:
 *   - measure the trigger via `getBoundingClientRect()`
 *   - `position: fixed` placement with logical-start / logical-end alignment
 *   - horizontal + vertical viewport clamping, flip-above when space is short
 *   - reposition on resize / scroll (capture phase, so scrollable ancestors count)
 *   - dismiss on outside pointer, Escape, or the trigger leaving the viewport
 *
 * The consumer renders the trigger (attaching `triggerRef`) and the portalled
 * panel (attaching `panelRef` + spreading `style`); it owns the panel content,
 * focus handling, and any business logic. Used by the User status confirmation
 * and available for other anchored popovers (e.g. the Quick Reply dropdown).
 */

export type AnchoredAlign = "start" | "end";

export interface AnchoredPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

export interface AnchoredViewport {
  width: number;
  height: number;
}

export interface AnchoredGeometryOptions {
  align: AnchoredAlign;
  rtl: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  gap: number;
  margin: number;
  maxHeight: number;
  minHeight: number;
}

const DEFAULTS = {
  align: "start" as AnchoredAlign,
  width: 300,
  minWidth: 280,
  maxWidth: 320,
  gap: 6,
  margin: 8,
  maxHeight: 560,
  minHeight: 120,
};

/** Pure placement math — unit-testable without a layout engine. */
export function computeAnchoredPosition(
  rect: Pick<DOMRect, "top" | "bottom" | "left" | "right" | "width">,
  viewport: AnchoredViewport,
  options: AnchoredGeometryOptions,
): AnchoredPosition {
  const { align, rtl, gap, margin, maxHeight, minHeight } = options;

  const width = Math.min(
    Math.max(Math.min(options.width, options.maxWidth), options.minWidth),
    Math.max(options.minWidth, viewport.width - margin * 2),
  );

  // Logical-end alignment pins the panel's end edge to the trigger's end edge.
  const alignToTriggerEnd = (align === "end") !== rtl;
  let left = alignToTriggerEnd ? rect.right - width : rect.left;
  left = Math.min(Math.max(left, margin), Math.max(margin, viewport.width - width - margin));

  const spaceBelow = viewport.height - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const clampHeight = (space: number) => Math.max(minHeight, Math.min(maxHeight, space));

  if (spaceBelow >= Math.min(maxHeight, 160) || spaceBelow >= spaceAbove) {
    return { left, width, top: rect.bottom + gap, maxHeight: clampHeight(spaceBelow) };
  }
  return { left, width, bottom: viewport.height - rect.top + gap, maxHeight: clampHeight(spaceAbove) };
}

function isTriggerOffscreen(rect: DOMRect, viewport: AnchoredViewport) {
  // An all-zero rect means "not laid out yet" (e.g. JSDOM), not "scrolled away".
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) return false;
  return rect.bottom < 0 || rect.right < 0 || rect.top > viewport.height || rect.left > viewport.width;
}

export type AnchoredDismissReason = "outside" | "escape" | "offscreen";

export interface UseAnchoredPopoverOptions {
  open: boolean;
  onDismiss: (reason: AnchoredDismissReason) => void;
  align?: AnchoredAlign;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  gap?: number;
  margin?: number;
  maxHeight?: number;
  minHeight?: number;
}

export interface UseAnchoredPopoverResult<T extends HTMLElement, P extends HTMLElement> {
  triggerRef: RefObject<T | null>;
  panelRef: RefObject<P | null>;
  position: AnchoredPosition | null;
  style: CSSProperties;
}

export function useAnchoredPopover<T extends HTMLElement = HTMLElement, P extends HTMLElement = HTMLElement>(
  options: UseAnchoredPopoverOptions,
): UseAnchoredPopoverResult<T, P> {
  const { open, onDismiss } = options;
  const triggerRef = useRef<T | null>(null);
  const panelRef = useRef<P | null>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const geometry: AnchoredGeometryOptions = {
    align: options.align ?? DEFAULTS.align,
    rtl: typeof document !== "undefined" && document.documentElement.getAttribute("dir") === "rtl",
    width: options.width ?? DEFAULTS.width,
    minWidth: options.minWidth ?? DEFAULTS.minWidth,
    maxWidth: options.maxWidth ?? DEFAULTS.maxWidth,
    gap: options.gap ?? DEFAULTS.gap,
    margin: options.margin ?? DEFAULTS.margin,
    maxHeight: options.maxHeight ?? DEFAULTS.maxHeight,
    minHeight: options.minHeight ?? DEFAULTS.minHeight,
  };
  const geometryKey = JSON.stringify(geometry);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    if (isTriggerOffscreen(rect, viewport)) {
      onDismissRef.current("offscreen");
      return;
    }
    setPosition(computeAnchoredPosition(rect, viewport, JSON.parse(geometryKey) as AnchoredGeometryOptions));
  }, [geometryKey]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    reposition();
    const handler = () => reposition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: Event) => {
      let target = event.target as Node | null;
      if (!target) return;

      // A nested Radix overlay (Select / Menu) sets `pointer-events: none` on
      // <body> while it is open, so a click that is visually inside our panel
      // lands on <body> / <html>. Re-resolve the real element under the pointer
      // before treating it as an outside click.
      if (
        (target === document.body || target === document.documentElement) &&
        typeof (event as PointerEvent).clientX === "number"
      ) {
        const pointer = event as PointerEvent;
        const resolved = document.elementFromPoint(pointer.clientX, pointer.clientY);
        if (resolved) target = resolved;
      }

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;

      // Do not dismiss when interacting with portalled select / menu / dialog items
      if (
        target instanceof Element &&
        target.closest(
          "[data-radix-popper-content-wrapper], [data-radix-select-content], [data-radix-portal], [data-app-select-search], [role='listbox'], [role='option'], [role='menu'], [role='menuitem']"
        )
      ) {
        return;
      }

      onDismissRef.current("outside");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismissRef.current("escape");
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const style: CSSProperties = position
    ? { left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }
    : {};

  return { triggerRef, panelRef, position, style };
}
