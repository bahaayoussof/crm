/**
 * Dependency-free date helpers for the branded CRM calendar.
 *
 * Formatting goes through `Intl.DateTimeFormat` to match the project convention
 * used by every feature-level format helper. Calendar-grid math is plain arithmetic
 * on local-time `Date` values — no third-party date library.
 */

export interface DateRange {
  from?: Date;
  to?: Date;
}

export interface RangePreset {
  key: string;
  label: string;
  getRange: () => DateRange;
}

/** Built-in quick ranges for `DateRangePicker`. `translate` is `i18next`'s `t`. */
export function buildDefaultPresets(translate: (key: string) => string): RangePreset[] {
  const today = () => startOfDay(new Date());
  return [
    { key: "today", label: translate("datePicker.presets.today"), getRange: () => ({ from: today(), to: today() }) },
    {
      key: "yesterday",
      label: translate("datePicker.presets.yesterday"),
      getRange: () => ({ from: addDays(today(), -1), to: addDays(today(), -1) }),
    },
    {
      key: "last7",
      label: translate("datePicker.presets.last7"),
      getRange: () => ({ from: addDays(today(), -6), to: today() }),
    },
    {
      key: "last30",
      label: translate("datePicker.presets.last30"),
      getRange: () => ({ from: addDays(today(), -29), to: today() }),
    },
    {
      key: "thisMonth",
      label: translate("datePicker.presets.thisMonth"),
      getRange: () => ({ from: startOfMonth(new Date()), to: today() }),
    },
    {
      key: "lastMonth",
      label: translate("datePicker.presets.lastMonth"),
      getRange: () => {
        const start = startOfMonth(addMonths(new Date(), -1));
        return { from: start, to: endOfMonth(start) };
      },
    },
  ];
}

/** BCP-47 tag for the active app language (mirrors the existing format utils). */
export function localeTag(language: string): string {
  return language === "ar" ? "ar-EG" : "en-US";
}

/**
 * First weekday of the calendar grid: 0 = Sunday … 6 = Saturday.
 * English calendars start on Sunday, Arabic on Saturday.
 */
export function weekStartFor(language: string): number {
  return language === "ar" ? 6 : 0;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function isSameDay(a?: Date | null, b?: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Day-granularity comparison: -1 if a<b, 0 if same day, 1 if a>b. */
export function compareDay(a: Date, b: Date): number {
  const da = startOfDay(a).getTime();
  const db = startOfDay(b).getTime();
  return da < db ? -1 : da > db ? 1 : 0;
}

export function isBeforeDay(a: Date, b: Date): boolean {
  return compareDay(a, b) < 0;
}

export function isAfterDay(a: Date, b: Date): boolean {
  return compareDay(a, b) > 0;
}

export function isWithinRange(day: Date, from: Date, to: Date): boolean {
  return compareDay(day, from) >= 0 && compareDay(day, to) <= 0;
}

export function clampDate(date: Date, min?: Date, max?: Date): Date {
  if (min && isBeforeDay(date, min)) return startOfDay(min);
  if (max && isAfterDay(date, max)) return startOfDay(max);
  return date;
}

export function isDisabledDay(day: Date, min?: Date, max?: Date): boolean {
  if (min && isBeforeDay(day, min)) return true;
  if (max && isAfterDay(day, max)) return true;
  return false;
}

/**
 * 6×7 grid of days covering `month`, aligned so the first column is
 * `weekStartsOn`. Always 42 cells for a stable layout.
 */
export function buildMonthGrid(month: Date, weekStartsOn: number): Date[] {
  const first = startOfMonth(month);
  const offset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

/** Localized short weekday labels, ordered from `weekStartsOn`. */
export function weekdayLabels(language: string, weekStartsOn: number): string[] {
  const formatter = new Intl.DateTimeFormat(localeTag(language), { weekday: "short" });
  // 2023-01-01 is a Sunday — a safe anchor for indexing weekdays.
  const sunday = new Date(2023, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addDays(sunday, (weekStartsOn + index) % 7)),
  );
}

/** Localized "Month YYYY" heading. */
export function formatMonthYear(month: Date, language: string): string {
  return new Intl.DateTimeFormat(localeTag(language), {
    month: "long",
    year: "numeric",
  }).format(month);
}

/** Localized month names, index 0–11. */
export function monthNames(language: string): string[] {
  const formatter = new Intl.DateTimeFormat(localeTag(language), { month: "long" });
  return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2023, index, 1)));
}

/** Medium-style single date, e.g. "Aug 28, 2026". */
export function formatDisplayDate(date: Date, language: string): string {
  return new Intl.DateTimeFormat(localeTag(language), { dateStyle: "medium" }).format(date);
}

/** Medium date + short time, e.g. "Aug 28, 2026, 2:30 PM". */
export function formatDisplayDateTime(date: Date, language: string): string {
  return new Intl.DateTimeFormat(localeTag(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Two-digit number in the active locale's digits (for hour / minute options). */
export function formatTwoDigits(value: number, language: string): string {
  return new Intl.NumberFormat(localeTag(language), {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(value);
}

/** Copy `date`'s calendar day but set hours/minutes (seconds & ms zeroed). */
export function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/** Round minutes down to the nearest `step` (e.g. 5 → :00 :05 :10 …). */
export function roundMinutesToStep(minutes: number, step: number): number {
  if (step <= 1) return minutes;
  return Math.floor(minutes / step) * step;
}

/** Day-of-month rendered in the active locale's digits. */
export function formatDayNumber(date: Date, language: string): string {
  return new Intl.DateTimeFormat(localeTag(language), { day: "numeric" }).format(date);
}

/**
 * Range label for a trigger. Collapses to a compact form when both dates share
 * a year; the caller controls direction via the surrounding `dir`.
 */
export function formatDisplayRange(range: DateRange, language: string): string | null {
  const { from, to } = range;
  if (!from && !to) return null;
  if (from && !to) return formatDisplayDate(from, language);
  if (!from && to) return formatDisplayDate(to, language);
  if (from && to) {
    if (isSameDay(from, to)) return formatDisplayDate(from, language);

    const formatter = new Intl.DateTimeFormat(localeTag(language), {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    return formatter.formatRange(from, to);
  }
  return null;
}
