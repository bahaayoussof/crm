import axios from "axios";
import type { TFunction } from "i18next";
export function getTicketError(error: unknown, fallback: string, t: TFunction) {
  if (!axios.isAxiosError(error)) return fallback;
  const code = error.response?.data?.error?.code as string | undefined;
  return code ? t(`tickets.errors.${code}`, { defaultValue: fallback }) : fallback;
}
export function getTicketErrorStatus(error: unknown) { return axios.isAxiosError(error) ? error.response?.status : undefined; }
