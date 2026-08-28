type Translate = (key: string, opts?: Record<string, unknown>) => string;

const NBSP = " ";

/**
 * Minutes → localized duration segments, e.g. `["7 h", "33 min"]` /
 * `["٧ ساعة", "٣٣ دقيقة"]` / `["—"]`.
 *
 * Each segment glues its number to its unit with a non-breaking space, and the
 * unit words come from count-aware i18n keys (`hoursUnit`/`minutesUnit` with
 * plural suffixes) so Arabic reads `ساعة` / `ساعتان` / `ساعات` naturally.
 * `<Duration>` renders one `<bdi>` per segment with a real space between them —
 * the value can wrap between segments if a card is narrow, but never splits a
 * number from its unit, and the run stays correctly ordered in LTR and RTL.
 */
export function formatDurationParts(
  minutes: number | null,
  t: Translate,
  nf: Intl.NumberFormat,
): string[] {
  if (minutes === null) return ["—"];
  const total = Math.round(minutes);
  if (total < 60) {
    return [`${nf.format(total)}${NBSP}${t("reports.duration.minutesUnit", { count: total })}`];
  }
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const parts = [`${nf.format(hours)}${NBSP}${t("reports.duration.hoursUnit", { count: hours })}`];
  if (rest > 0) {
    parts.push(`${nf.format(rest)}${NBSP}${t("reports.duration.minutesUnit", { count: rest })}`);
  }
  return parts;
}
