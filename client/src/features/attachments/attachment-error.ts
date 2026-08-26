import axios from "axios";
import type { TFunction } from "i18next";

/** Map a backend error code to a localized attachments string, with a safe fallback. */
export function getAttachmentError(error: unknown, fallbackKey: string, t: TFunction): string {
  const fallback = t(fallbackKey);
  if (!axios.isAxiosError(error)) return fallback;
  const code = error.response?.data?.error?.code as string | undefined;
  if (!code) return fallback;
  return t(`attachments.errors.${code}`, { defaultValue: fallback });
}

export function getAttachmentErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
