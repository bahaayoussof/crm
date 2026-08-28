import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectTriggerClassName } from "@/components/ui/select";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { Calendar } from "./calendar";
import { TimeField, type TimeValue } from "./time-field";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  roundMinutesToStep,
  setTimeOnDate,
  startOfDay,
  startOfMonth,
} from "./date-picker-utils";

export interface DatePickerProps {
  /**
   * Controlled selected value. With `showTime` the time-of-day is preserved;
   * otherwise the picker emits the day at local midnight.
   */
  value?: Date;
  onChange: (value: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  /** Show the "Clear" action in the popover footer. Default: true. */
  clearable?: boolean;
  /** Opt in to date + time selection. Off = unchanged date-only behavior. */
  showTime?: boolean;
  /** Minute granularity when `showTime` is set. Default: 5. */
  minuteStep?: number;
  id?: string;
  name?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Popover alignment relative to the trigger. */
  align?: "start" | "end";
}

const footerButtonClass =
  "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40";

function timePartsOf(date: Date | undefined, minuteStep: number): TimeValue {
  if (date) return { hours: date.getHours(), minutes: date.getMinutes() };
  const now = new Date();
  return { hours: now.getHours(), minutes: roundMinutesToStep(now.getMinutes(), minuteStep) };
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  minDate,
  maxDate,
  clearable = true,
  showTime = false,
  minuteStep = 5,
  id,
  name,
  ariaLabel,
  ariaDescribedby,
  invalid,
  className,
  triggerClassName,
  align = "start",
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(value ?? new Date()));
  // Only used in `showTime` mode: the popover holds a draft until "Apply".
  const [draft, setDraft] = React.useState<Date | undefined>(value);

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
    maxHeight: showTime ? 520 : 460,
  });

  React.useEffect(() => {
    if (!open) return;
    setViewMonth(startOfMonth(value ?? new Date()));
    setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, [triggerRef]);

  const label = value
    ? showTime
      ? formatDisplayDateTime(value, i18n.language)
      : formatDisplayDate(value, i18n.language)
    : placeholder ?? t("datePicker.placeholder");

  const timeParts = timePartsOf(draft ?? value, minuteStep);

  const handleDaySelect = (date: Date) => {
    if (!showTime) {
      onChange(date);
      close();
      return;
    }
    setViewMonth(startOfMonth(date));
    setDraft(setTimeOnDate(date, timeParts.hours, timeParts.minutes));
  };

  const handleTimeChange = (next: TimeValue) => {
    const base = draft ?? value ?? startOfDay(new Date());
    setDraft(setTimeOnDate(base, next.hours, next.minutes));
  };

  return (
    <div className={cn("relative w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
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
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <span
          dir="auto"
          className={cn(
            "min-w-0 flex-1 truncate text-start",
            value ? "text-foreground" : "text-muted-foreground/75",
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
            aria-label={ariaLabel ?? t("datePicker.placeholder")}
            style={style}
            className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-flyout"
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              <Calendar
                mode="single"
                selected={showTime ? draft : value}
                month={viewMonth}
                onMonthChange={setViewMonth}
                minDate={minDate}
                maxDate={maxDate}
                onSelect={handleDaySelect}
              />

              {showTime && (
                <div className="border-t border-border pt-3">
                  <TimeField
                    value={timeParts}
                    onChange={handleTimeChange}
                    minuteStep={minuteStep}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
              <button
                type="button"
                className={footerButtonClass}
                onClick={() => {
                  const now = new Date();
                  setViewMonth(startOfMonth(now));
                  if (showTime) {
                    setDraft(now);
                  } else {
                    onChange(now);
                    close();
                  }
                }}
              >
                {t("datePicker.today")}
              </button>

              <div className="flex items-center gap-0.5">
                {clearable && (
                  <button
                    type="button"
                    disabled={showTime ? !draft && !value : !value}
                    className={footerButtonClass}
                    onClick={() => {
                      setDraft(undefined);
                      onChange(undefined);
                      close();
                    }}
                  >
                    {t("datePicker.clear")}
                  </button>
                )}
                {showTime && (
                  <button
                    type="button"
                    disabled={!draft}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
                    onClick={() => {
                      onChange(draft);
                      close();
                    }}
                  >
                    {t("datePicker.apply")}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
