import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "@/locales/ar/translation.json";
import en from "@/locales/en/translation.json";

void i18n.use(initReactI18next).init({ resources: { en: { translation: en }, ar: { translation: ar } }, lng: "en", fallbackLng: "en", interpolation: { escapeValue: false } });
i18n.on("languageChanged", (language) => {
  const direction = language === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = language;
  document.documentElement.dir = direction;
});

export default i18n;
