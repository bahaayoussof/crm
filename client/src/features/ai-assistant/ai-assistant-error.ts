import axios from "axios";
import type { TFunction } from "i18next";

/** Error codes with a dedicated localized message. */
const KNOWN_ERROR_CODES = new Set([
  "AI_TIMEOUT",
  "AI_GENERATION_FAILED",
  "RATE_LIMITED",
  "AI_PROVIDER_RATE_LIMITED",
  "TICKET_NOT_FOUND",
]);

export function getAiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return error.response?.data?.error?.code as string | undefined;
}

/** AI_NOT_CONFIGURED gets its own non-error "unavailable" treatment. */
export function isAiNotConfigured(error: unknown): boolean {
  return getAiErrorCode(error) === "AI_NOT_CONFIGURED";
}

/** No active categories to classify against — a friendly state, not a failure;
 * retrying cannot help. */
export function isAiNoCandidates(error: unknown): boolean {
  return getAiErrorCode(error) === "AI_NO_CANDIDATES";
}

/**
 * Map any AI failure to a safe localized string. Raw provider/OpenRouter text is
 * never surfaced — unknown codes and network errors fall back to a generic line.
 */
export function getAiErrorMessage(error: unknown, t: TFunction): string {
  const code = getAiErrorCode(error);
  if (code && KNOWN_ERROR_CODES.has(code)) return t(`aiAssistant.errors.${code}`);
  return t("aiAssistant.errors.generic");
}
