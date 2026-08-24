import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar/translation.json";
import en from "@/locales/en/translation.json";
import { persistLanguage, readStoredLanguage, resolveSupportedLanguage, syncDocumentLanguage, type SupportedLanguage } from "./language";

const initialLanguage = readStoredLanguage();
syncDocumentLanguage(initialLanguage);

i18n.on("languageChanged", (language) => {
  const supportedLanguage = resolveSupportedLanguage(language);
  persistLanguage(supportedLanguage);
  syncDocumentLanguage(supportedLanguage);
  document.title = i18n.t("app.title", { lng: supportedLanguage });
});

export const i18nReady = i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: ["en", "ar"],
  interpolation: { escapeValue: false },
});

export function changeAppLanguage(language: SupportedLanguage) {
  return i18n.changeLanguage(language);
}

export default i18n;
