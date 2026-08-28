import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectTriggerClassName } from "@/components/ui/select";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { Calendar } from "./calendar";
import {
  buildDefaultPresets,
  formatDisplayRange,
  startOfMonth,
  type DateRange,
  type RangePreset,
} from "./date-picker-utils";

export type { DateRange, RangePreset };

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (value: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  /** `true` shows the built-in presets; pass an array to customize. */
  presets?: boolean | RangePreset[];
  id?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "end";
}

const EMPTY_RANGE: DateRange = {};

export function DateRangePicker({
  value = EMPTY_RANGE,
  onChange,
  placeholder,
  disabled,
  minDate,
  maxDate,
  presets = false,
  id,
  ariaLabel,
  ariaDescribedby,
  invalid,
  className,
  triggerClassName,
  align = "start",
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange>(value);
  const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(value.from ?? new Date()));

  const presetList = React.useMemo<RangePreset[]>(() => {
    if (presets === false) return [];
    if (presets === true) return buildDefaultPresets(t);
    return presets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets, i18n.language]);

  const { triggerRef, panelRef, position, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: (reason) => {
      setOpen(false);
      if (reason === "escape") triggerRef.current?.focus();
    },
    align,
    width: 320,
    minWidth: 300,
    maxWidth: 340,
    gap: 6,
    maxHeight: 520,
  });

  React.useEffect(() => {
    if (!open) return;
    setDraft(value);
    setViewMonth(startOfMonth(value.from ?? new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [triggerRef]);

  const commit = React.useCallback(
    (range: DateRange) => {
      onChange(range);
      close();
    },
    [onChange, close],
  );

  const label = formatDisplayRange(value, i18n.language) ?? placeholder ?? t("datePicker.rangePlaceholder");
  const hasValue = Boolean(value.from || value.to);

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedby}
        aria-invalid={invalid ? "true" : undefined}
        data-state={open ? "open" : "closed"}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={cn(selectTriggerClassName, "gap-2", triggerClassName)}
      >
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <span
          dir="auto"
          className={cn(
            "min-w-0 flex-1 truncate text-start",
            hasValue ? "text-foreground" : "text-muted-foreground/75",
          )}
        >
          {label}
        </span>
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label={ariaLabel ?? t("datePicker.rangePlaceholder")}
            style={style}
            className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-flyout"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {presetList.length > 0 && (
                <ul className="flex flex-col gap-0.5 border-b border-border pb-3">
                  {presetList.map((preset) => (
                    <li key={preset.key}>
                      <button
                        type="button"
                        onClick={() => {
                          const range = preset.getRange();
                          setDraft(range);
                          setViewMonth(startOfMonth(range.from ?? new Date()));
                          commit(range);
                        }}
                        className="w-full rounded-md px-2.5 py-1.5 text-start text-sm text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover"
                      >
                        {preset.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <Calendar
                mode="range"
                selected={draft}
                month={viewMonth}
                onMonthChange={setViewMonth}
                minDate={minDate}
                maxDate={maxDate}
                onSelect={setDraft}
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
              <button
                type="button"
                disabled={!draft.from && !draft.to}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
                onClick={() => {
                  setDraft(EMPTY_RANGE);
                  commit(EMPTY_RANGE);
                }}
              >
                {t("datePicker.clear")}
              </button>
              <button
                type="button"
                disabled={!draft.from}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
                onClick={() => {
                  const finalRange: DateRange = draft.to
                    ? draft
                    : { from: draft.from, to: draft.from };
                  commit(finalRange);
                }}
              >
                {t("datePicker.apply")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
