import axios from "axios";
import type { TFunction } from "i18next";

export function getCustomerError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: { code?: string; message?: string } }>(error)) {
    return { status: error.response?.status, code: error.response?.data.error?.code, message: error.response?.data.error?.message ?? fallback };
  }
  return { status: undefined, code: undefined, message: fallback };
}

export function getLocalizedCustomerError(error: unknown, fallback: string, t: TFunction) {
  const result = getCustomerError(error, fallback);
  return result.code ? t(`customers.errors.${result.code}`, { defaultValue: result.message }) : result.message;
}
