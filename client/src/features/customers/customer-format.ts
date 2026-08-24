export function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}
