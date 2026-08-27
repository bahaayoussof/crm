import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  enabled?: boolean;
  delayMs?: number;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = "right",
  enabled = true,
  delayMs = 250,
  className,
}: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!enabled || !content) return <>{children}</>;

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delayMs);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const sidePositions = {
    top: "bottom-full mb-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
    bottom: "top-full mt-2 start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
    left: "end-full me-2.5 top-1/2 -translate-y-1/2",
    right: "start-full ms-2.5 top-1/2 -translate-y-1/2",
  };

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-flyout",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            sidePositions[side]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
