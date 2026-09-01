/** Compact minutes → `"2h 15m"` / `"45m"` / em-dash when null. */
export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function formatPercent(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "—" : `${Math.round(value)}%`;
}

export function formatRating(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "—" : value.toFixed(1);
}
