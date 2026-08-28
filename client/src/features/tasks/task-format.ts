export function formatTaskDateTime(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTaskDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

/** ISO instant -> value accepted by <input type="datetime-local"> in local time. */
export function isoToLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function isTaskOverdue(dueAt: string | null, status: string, now = Date.now()): boolean {
  return status === "OPEN" && dueAt !== null && new Date(dueAt).getTime() < now;
}
