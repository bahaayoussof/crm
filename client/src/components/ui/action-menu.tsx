import * as React from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { cn } from "@/lib/utils";

export interface ActionMenuItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  triggerLabel?: string;
  className?: string;
  align?: "start" | "end";
  externalTriggerRef?: React.Ref<HTMLButtonElement>;
}

export function ActionMenu({
  items,
  triggerLabel = "Actions",
  className,
  align = "end",
  externalTriggerRef,
}: ActionMenuProps) {
  const [open, setOpen] = React.useState(false);
  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: () => setOpen(false),
    align,
    width: 180,
    minWidth: 160,
    maxWidth: 220,
    gap: 4,
  });

  const handleRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
      if (typeof externalTriggerRef === "function") {
        externalTriggerRef(el);
      } else if (externalTriggerRef && "current" in externalTriggerRef) {
        (externalTriggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
      }
    },
    [externalTriggerRef, triggerRef]
  );

  return (
    <>
      <button
        ref={handleRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-surface-hover hover:text-foreground hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-surface-active text-foreground border-border-strong",
          className
        )}
      >
        <MoreVertical className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ ...style, position: "fixed" }}
            role="menu"
            className="z-50 min-w-40 rounded-md border border-border bg-popover text-popover-foreground p-1 shadow-flyout animate-in fade-in-0 zoom-in-95 duration-100"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium transition-colors text-start",
                  item.destructive
                    ? "text-danger hover:bg-danger-soft hover:text-danger-foreground focus-visible:bg-danger-soft"
                    : "text-foreground hover:bg-surface-hover focus-visible:bg-surface-hover",
                  item.disabled && "pointer-events-none opacity-50"
                )}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
