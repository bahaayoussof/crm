/** Medium-style date for the profile UI (joined date, password last changed). */
export function formatProfileDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

/** Presentation-friendly current UI language name. Informational only. */
export function currentLanguageLabel(language: string): string {
  return language.startsWith("ar") ? "العربية" : "English";
}

/** Runtime IANA time zone, e.g. "Africa/Cairo". Informational only. */
export function runtimeTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "-";
  } catch {
    return "-";
  }
}
