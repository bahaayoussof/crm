import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/lib/i18n";
import { resolveSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/lib/language";

const languageLabels: Record<SupportedLanguage, string> = { en: "English", ar: "العربية" };

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const activeLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return <div className="fixed bottom-4 end-4 z-50 rounded-md border bg-white p-1 shadow-sm" role="group" aria-label={t("navigation.languageSwitcher")}>
    {supportedLanguages.map((language) => <button
      type="button"
      key={language}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      aria-pressed={activeLanguage === language}
      className={`rounded px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeLanguage === language ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      onClick={() => void changeAppLanguage(language)}
    >{languageLabels[language]}</button>)}
  </div>;
}
