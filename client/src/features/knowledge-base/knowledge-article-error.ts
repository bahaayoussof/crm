import axios from "axios";
import type { TFunction } from "i18next";

export function getKnowledgeArticleError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: { code?: string; message?: string } }>(error)) {
    return { status: error.response?.status, code: error.response?.data?.error?.code, message: error.response?.data?.error?.message ?? fallback };
  }
  return { status: undefined, code: undefined, message: fallback };
}

export function getLocalizedKnowledgeArticleError(error: unknown, fallback: string, t: TFunction) {
  const result = getKnowledgeArticleError(error, fallback);
  return result.code ? t(`knowledgeBase.errors.${result.code}`, { defaultValue: result.message }) : result.message;
}
