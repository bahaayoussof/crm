export const LANGUAGE_STORAGE_KEY = "crm-language";
export const supportedLanguages = ["en", "ar"] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export function resolveSupportedLanguage(value: unknown): SupportedLanguage {
  return value === "ar" ? "ar" : "en";
}

export function readStoredLanguage(): SupportedLanguage {
  try {
    return resolveSupportedLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

export function persistLanguage(language: SupportedLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The selected language still applies for this session when storage is unavailable.
  }
}

export function syncDocumentLanguage(language: SupportedLanguage) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}
