export function formatTicketDate(value: string | null, language: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function ticketReference(id: string) { return `#${id.slice(-8).toUpperCase()}`; }
