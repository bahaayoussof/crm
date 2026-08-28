import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addMonths,
  buildMonthGrid,
  clampDate,
  formatDayNumber,
  isAfterDay,
  isBeforeDay,
  isDisabledDay,
  isSameDay,
  isSameMonth,
  isWithinRange,
  monthNames,
  startOfDay,
  weekdayLabels,
  weekStartFor,
  type DateRange,
} from "./date-picker-utils";

type SingleProps = {
  mode: "single";
  selected?: Date;
  onSelect: (date: Date) => void;
};

type RangeProps = {
  mode: "range";
  selected: DateRange;
  onSelect: (range: DateRange) => void;
};

export type CalendarProps = (SingleProps | RangeProps) & {
  /** Controlled visible month (day is ignored). */
  month: Date;
  onMonthChange: (month: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
};

const YEAR_SPAN = 12;

function isRtl(): boolean {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl";
}

export function Calendar(props: CalendarProps) {
  const { month, onMonthChange, minDate, maxDate, className } = props;
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const weekStartsOn = weekStartFor(language);
  const rtl = isRtl();

  const weekdays = React.useMemo(
    () => weekdayLabels(language, weekStartsOn),
    [language, weekStartsOn],
  );
  const months = React.useMemo(() => monthNames(language), [language]);

  const rangeSelected = props.mode === "range" ? props.selected : undefined;
  const singleSelected = props.mode === "single" ? props.selected : undefined;

  // Hover-preview target while a range's second endpoint is still open.
  const [hovered, setHovered] = React.useState<Date | null>(null);
  const rangeInProgress = Boolean(rangeSelected?.from && !rangeSelected?.to);

  // Roving focus target for keyboard grid navigation.
  const initialFocus = React.useMemo(() => {
    const candidate = singleSelected ?? rangeSelected?.from ?? new Date();
    return clampDate(startOfDay(candidate), minDate, maxDate);
  }, [singleSelected, rangeSelected?.from, minDate, maxDate]);
  const [focusedDate, setFocusedDate] = React.useState<Date>(initialFocus);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const shouldFocusCell = React.useRef(false);

  React.useEffect(() => {
    if (!shouldFocusCell.current) return;
    shouldFocusCell.current = false;
    const node = gridRef.current?.querySelector<HTMLButtonElement>('[data-focus-cell="true"]');
    node?.focus();
  });

  const moveFocus = (next: Date) => {
    const clamped = clampDate(startOfDay(next), minDate, maxDate);
    shouldFocusCell.current = true;
    setFocusedDate(clamped);
    if (!isSameMonth(clamped, month)) {
      onMonthChange(new Date(clamped.getFullYear(), clamped.getMonth(), 1));
    }
  };

  const commit = (day: Date) => {
    if (isDisabledDay(day, minDate, maxDate)) return;
    if (props.mode === "single") {
      props.onSelect(startOfDay(day));
      return;
    }
    const current = props.selected;
    if (!current.from || current.to || isBeforeDay(day, current.from)) {
      props.onSelect({ from: startOfDay(day), to: undefined });
    } else {
      props.onSelect({ from: current.from, to: startOfDay(day) });
    }
  };

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = rtl ? -1 : 1;
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, forward));
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, -forward));
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, -7));
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, 7));
        break;
      case "Home":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, -focusedDate.getDay()));
        break;
      case "End":
        event.preventDefault();
        moveFocus(addDaysLocal(focusedDate, 6 - focusedDate.getDay()));
        break;
      case "PageUp":
        event.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth() - 1, focusedDate.getDate()));
        break;
      case "PageDown":
        event.preventDefault();
        moveFocus(new Date(focusedDate.getFullYear(), focusedDate.getMonth() + 1, focusedDate.getDate()));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(focusedDate);
        break;
      default:
        break;
    }
  };

  const prevDisabled = minDate ? isBeforeDay(endOfPrevMonth(month), startOfDay(minDate)) : false;
  const nextDisabled = maxDate
    ? isAfterDay(startOfNextMonth(month), startOfDay(maxDate))
    : false;

  const yearOptions = React.useMemo(() => {
    const base = month.getFullYear();
    const lo = minDate ? minDate.getFullYear() : base - YEAR_SPAN;
    const hi = maxDate ? maxDate.getFullYear() : base + YEAR_SPAN;
    const years: number[] = [];
    for (let year = Math.min(lo, base); year <= Math.max(hi, base); year += 1) years.push(year);
    return years.map((year) => ({
      value: String(year),
      label: new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
        useGrouping: false,
      }).format(year),
    }));
  }, [month, minDate, maxDate, language]);

  const monthOptions = months.map((name, index) => ({ value: String(index), label: name }));

  return (
    <div className={cn("select-none space-y-3", className)}>
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          disabled={prevDisabled}
          aria-label={t("datePicker.previousMonth")}
          className={navButtonClass}
        >
          {rtl ? <ChevronRight className="size-4" strokeWidth={2} aria-hidden /> : <ChevronLeft className="size-4" strokeWidth={2} aria-hidden />}
        </button>

        <div className="flex items-center gap-0.5">
          <HeaderSelect
            ariaLabel={t("datePicker.month")}
            value={String(month.getMonth())}
            options={monthOptions}
            onChange={(value) => onMonthChange(new Date(month.getFullYear(), Number(value), 1))}
          />
          <HeaderSelect
            ariaLabel={t("datePicker.year")}
            value={String(month.getFullYear())}
            options={yearOptions}
            onChange={(value) => onMonthChange(new Date(Number(value), month.getMonth(), 1))}
          />
        </div>

        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={nextDisabled}
          aria-label={t("datePicker.nextMonth")}
          className={navButtonClass}
        >
          {rtl ? <ChevronLeft className="size-4" strokeWidth={2} aria-hidden /> : <ChevronRight className="size-4" strokeWidth={2} aria-hidden />}
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-multiselectable={props.mode === "range" || undefined}
        onKeyDown={handleGridKeyDown}
      >
        <MonthGrid
          month={month}
          weekStartsOn={weekStartsOn}
          weekdays={weekdays}
          language={language}
          minDate={minDate}
          maxDate={maxDate}
          focusedDate={focusedDate}
          singleSelected={singleSelected}
          rangeSelected={rangeSelected}
          rangeInProgress={rangeInProgress}
          hovered={hovered}
          onHover={setHovered}
          onCommit={commit}
          onFocusDate={(day) => setFocusedDate(day)}
        />
      </div>
    </div>
  );
}

const navButtonClass =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40";

interface HeaderSelectProps {
  ariaLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/**
 * Compact month / year trigger. The list is rendered *inside* the calendar
 * (not portalled), so the parent date-picker popover treats interaction with it
 * as internal and stays open. Closing the list returns focus to the trigger.
 */
function HeaderSelect({ ariaLabel, value, options, onChange }: HeaderSelectProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selectedIndex = React.useMemo(
    () => Math.max(0, options.findIndex((option) => option.value === value)),
    [options, value],
  );
  const [activeIndex, setActiveIndex] = React.useState(selectedIndex);
  const selectedLabel = options[selectedIndex]?.label ?? "";

  React.useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
    const raf = requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
      listRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ": {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) commit(option.value);
        break;
      }
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=open]:bg-surface-hover"
      >
        {selectedLabel}
        <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          onKeyDown={handleListKeyDown}
          className="absolute start-0 top-full z-20 mt-1 max-h-56 min-w-[7rem] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-flyout focus:outline-none"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                data-active={index === activeIndex || undefined}
                onClick={() => commit(option.value)}
                onMouseEnter={() => setActiveIndex(index)}
                className="cursor-pointer select-none rounded-sm px-2 py-1.5 text-sm text-foreground transition-colors data-[active]:bg-surface-hover aria-selected:bg-surface-active aria-selected:font-medium"
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface MonthGridProps {
  month: Date;
  weekStartsOn: number;
  weekdays: string[];
  language: string;
  minDate?: Date;
  maxDate?: Date;
  focusedDate: Date;
  singleSelected?: Date;
  rangeSelected?: DateRange;
  rangeInProgress: boolean;
  hovered: Date | null;
  onHover: (date: Date | null) => void;
  onCommit: (date: Date) => void;
  onFocusDate: (date: Date) => void;
}

function MonthGrid({
  month,
  weekStartsOn,
  weekdays,
  language,
  minDate,
  maxDate,
  focusedDate,
  singleSelected,
  rangeSelected,
  rangeInProgress,
  hovered,
  onHover,
  onCommit,
  onFocusDate,
}: MonthGridProps) {
  const days = React.useMemo(() => buildMonthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const today = startOfDay(new Date());

  const effectiveRange = React.useMemo<DateRange | undefined>(() => {
    if (!rangeSelected) return undefined;
    if (rangeInProgress && rangeSelected.from && hovered) {
      return isBeforeDay(hovered, rangeSelected.from)
        ? { from: hovered, to: rangeSelected.from }
        : { from: rangeSelected.from, to: hovered };
    }
    return rangeSelected;
  }, [rangeSelected, rangeInProgress, hovered]);

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-7">
        {weekdays.map((label, index) => (
          <div
            key={`${label}-${index}`}
            role="columnheader"
            aria-label={label}
            className="flex h-8 items-center justify-center text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div role="rowgroup" className="grid grid-cols-7">
        {days.map((day) => {
          const outside = day.getMonth() !== month.getMonth();
          const disabled = isDisabledDay(day, minDate, maxDate);
          const isToday = isSameDay(day, today);

          const isSingle = isSameDay(day, singleSelected);
          const isRangeStart = isSameDay(day, effectiveRange?.from);
          const isRangeEnd = isSameDay(day, effectiveRange?.to);
          const inRange =
            effectiveRange?.from &&
            effectiveRange?.to &&
            isWithinRange(day, effectiveRange.from, effectiveRange.to);
          const isMiddle = Boolean(inRange) && !isRangeStart && !isRangeEnd;
          const isEndpoint = isSingle || isRangeStart || isRangeEnd;

          const isFocusCell = isSameDay(day, focusedDate);

          return (
            <div
              key={day.toISOString()}
              role="gridcell"
              aria-selected={isEndpoint || undefined}
              className={cn(
                "flex items-center justify-center py-0.5",
                isMiddle && "bg-primary-subtle",
                inRange && isRangeStart && "rounded-s-md bg-primary-subtle",
                inRange && isRangeEnd && "rounded-e-md bg-primary-subtle",
              )}
            >
              <button
                type="button"
                tabIndex={isFocusCell ? 0 : -1}
                data-focus-cell={isFocusCell || undefined}
                data-today={isToday || undefined}
                disabled={disabled}
                aria-label={new Intl.DateTimeFormat(
                  language === "ar" ? "ar-EG" : "en-US",
                  { dateStyle: "full" },
                ).format(day)}
                aria-current={isToday ? "date" : undefined}
                onClick={() => {
                  onFocusDate(startOfDay(day));
                  onCommit(day);
                }}
                onMouseEnter={() => !disabled && onHover(startOfDay(day))}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  "relative inline-flex size-9 items-center justify-center rounded-md text-sm transition-colors",
                  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  !isEndpoint && !disabled && "hover:bg-surface-hover",
                  outside && !isEndpoint ? "text-muted-foreground/50" : "text-foreground",
                  isToday && !isEndpoint && "font-semibold ring-1 ring-inset ring-border-strong",
                  isEndpoint &&
                    "bg-primary font-medium text-primary-foreground hover:bg-primary-hover",
                  isMiddle && "text-foreground",
                  disabled && "pointer-events-none text-muted-foreground/40",
                )}
              >
                {formatDayNumber(day, language)}
                {isToday && !isEndpoint && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 size-1 rounded-full bg-primary"
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function addDaysLocal(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function endOfPrevMonth(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth(), 0);
}

function startOfNextMonth(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth() + 1, 1);
}
