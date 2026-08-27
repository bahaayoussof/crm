import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, X } from "lucide-react";
import { AppSelect } from "@/components/ui/app-select";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";

interface Option {
  value: string;
  label: string;
}

interface TicketFiltersPopoverProps {
  status?: string;
  priority?: string;
  categoryId?: string;
  assignedAgentId?: string;
  statusOptions: Option[];
  priorityOptions: Option[];
  categoryOptions: Option[];
  agentOptions: Option[];
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
}

export function TicketFiltersPopover({
  status,
  priority,
  categoryId,
  assignedAgentId,
  statusOptions,
  priorityOptions,
  categoryOptions,
  agentOptions,
  onFilterChange,
  onClearFilters,
}: TicketFiltersPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const activeCount = [status, priority, categoryId, assignedAgentId].filter(Boolean).length;

  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: () => setOpen(false),
    align: "end",
    gap: 6,
    width: 288,
    maxHeight: 560,
  });

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("tickets.filterOptions", "Filter options")}
        className={`inline-flex h-8.5 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          activeCount > 0
            ? "border-primary/40 bg-primary/5 text-foreground font-semibold"
            : "border-border bg-surface text-foreground hover:bg-surface-hover"
        }`}
      >
        <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span>{t("common.filters", "Filters")}</span>
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
            aria-label={t("common.filters", "Filters")}
            className="fixed z-50 w-72 flex flex-col rounded-xl border border-border bg-popover p-3.5 text-start text-popover-foreground shadow-flyout space-y-3 animate-in fade-in-0 zoom-in-95 duration-100 overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/70 pb-2">
              <span className="text-xs font-semibold text-foreground">
                {t("common.filters", "Filters")}
              </span>
              <div className="flex items-center gap-2">
                {activeCount > 0 && (
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

            <div className="space-y-2.5 overflow-y-auto pe-0.5">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("tickets.statusLabel")}
                </label>
                <AppSelect
                  ariaLabel={t("tickets.statusLabel")}
                  value={status ?? ""}
                  onValueChange={(val) => onFilterChange("status", val)}
                  options={statusOptions}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("tickets.priorityLabel")}
                </label>
                <AppSelect
                  ariaLabel={t("tickets.priorityLabel")}
                  value={priority ?? ""}
                  onValueChange={(val) => onFilterChange("priority", val)}
                  options={priorityOptions}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("tickets.category")}
                </label>
                <AppSelect
                  ariaLabel={t("tickets.category")}
                  value={categoryId ?? ""}
                  onValueChange={(val) => onFilterChange("categoryId", val)}
                  options={categoryOptions}
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {t("tickets.assignedAgent")}
                </label>
                <AppSelect
                  ariaLabel={t("tickets.assignedAgent")}
                  value={assignedAgentId ?? ""}
                  onValueChange={(val) => onFilterChange("assignedAgentId", val)}
                  options={agentOptions}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-border/70 pt-2 flex justify-end">
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
