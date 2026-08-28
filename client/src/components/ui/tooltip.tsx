import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  enabled?: boolean;
  delayMs?: number;
  className?: string;
}

const GAP = 10;

type PlacedTooltip = { top: number; left: number; transform: string };

/**
 * Hover tooltip. The floating layer is portalled to <body> with `position: fixed`
 * so it escapes any ancestor's overflow clipping — a collapsed sidebar rail uses
 * `overflow-y-auto`, and an absolutely-positioned child sticking out the side
 * would otherwise force a horizontal scrollbar inside the rail.
 */
export function Tooltip({
  content,
  children,
  side = "right",
  enabled = true,
  delayMs = 250,
  className,
}: TooltipProps) {
  const [placement, setPlacement] = React.useState<PlacedTooltip | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const place = React.useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rtl =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("dir") === "rtl";

    let physicalSide = side;
    if (side === "left") physicalSide = rtl ? "right" : "left";
    else if (side === "right") physicalSide = rtl ? "left" : "right";

    switch (physicalSide) {
      case "top":
        setPlacement({
          top: rect.top - GAP,
          left: rect.left + rect.width / 2,
          transform: "translate(-50%, -100%)",
        });
        break;
      case "bottom":
        setPlacement({
          top: rect.bottom + GAP,
          left: rect.left + rect.width / 2,
          transform: "translate(-50%, 0)",
        });
        break;
      case "left":
        setPlacement({
          top: rect.top + rect.height / 2,
          left: rect.left - GAP,
          transform: "translate(-100%, -50%)",
        });
        break;
      default:
        setPlacement({
          top: rect.top + rect.height / 2,
          left: rect.right + GAP,
          transform: "translate(0, -50%)",
        });
        break;
    }
  }, [side]);

  React.useEffect(() => {
    if (!placement) return;
    const handler = () => place();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [placement, place]);

  if (!enabled || !content) return <>{children}</>;

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      place();
    }, delayMs);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPlacement(null);
  };

  return (
    <div
      ref={wrapperRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {placement &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: placement.top,
              left: placement.left,
              transform: placement.transform,
            }}
            className={cn(
              "pointer-events-none z-[60] whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-flyout",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  );
}
