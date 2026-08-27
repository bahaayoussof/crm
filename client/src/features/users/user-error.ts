import axios from "axios";
import type { TFunction } from "i18next";

export function getUserError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: { code?: string; message?: string } }>(error)) {
    return { status: error.response?.status, code: error.response?.data?.error?.code, message: error.response?.data?.error?.message ?? fallback };
  }
  return { status: undefined, code: undefined, message: fallback };
}

export function getLocalizedUserError(error: unknown, fallback: string, t: TFunction) {
  const result = getUserError(error, fallback);
  return result.code ? t(`users.errors.${result.code}`, { defaultValue: result.message }) : result.message;
}
