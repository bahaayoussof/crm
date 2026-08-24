import axios from "axios";
import type { TFunction } from "i18next";

export function getAuthErrorMessage(error: unknown, t: TFunction) {
  if (axios.isAxiosError<{ error?: { code?: string } }>(error)) {
    const code = error.response?.data.error?.code;
    if (code) return t(`errors.auth.${code}`, { defaultValue: t("errors.generic") });
  }
  return t("errors.generic");
}
