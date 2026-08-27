import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, X } from "lucide-react";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { cn } from "@/lib/utils";

export interface DataTableFilterField {
  id: string;
  label: string;
  render: () => ReactNode;
}

export interface DataTableFiltersPopoverProps {
  activeCount?: number;
  onClearFilters?: () => void;
  title?: string;
  triggerLabel?: string;
  className?: string;
  children?: ReactNode;
  fields?: DataTableFilterField[];
}

export function DataTableFiltersPopover({
  activeCount = 0,
  onClearFilters,
  title,
  triggerLabel,
  className,
  children,
  fields,
}: DataTableFiltersPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: () => setOpen(false),
    align: "end",
    gap: 6,
    width: 288,
  });

  const displayTitle = title ?? t("common.filters", "Filters");
  const displayTrigger = triggerLabel ?? t("common.filters", "Filters");

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={displayTrigger}
        className={cn(
          "inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          activeCount > 0
            ? "border-primary/40 bg-primary/5 text-foreground font-semibold"
            : "border-border bg-surface text-foreground hover:bg-surface-hover"
        )}
      >
        <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span>{displayTrigger}</span>
        {activeCount > 0 && (
          <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            role="dialog"
            aria-label={displayTitle}
            className="fixed z-50 w-72 rounded-xl border border-border bg-popover p-3.5 text-start text-popover-foreground shadow-flyout space-y-3 animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <span className="text-xs font-semibold text-foreground">
                {displayTitle}
              </span>
              <div className="flex items-center gap-2">
                {activeCount > 0 && onClearFilters && (
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t("common.reset", "Reset")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={t("common.close", "Close")}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {fields ? (
                fields.map((field) => (
                  <div key={field.id}>
                    <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                      {field.label}
                    </label>
                    {field.render()}
                  </div>
                ))
              ) : (
                children
              )}
            </div>

            <div className="border-t border-border/70 pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="button-primary h-7.5 px-3 text-xs"
              >
                {t("common.done", "Done")}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
