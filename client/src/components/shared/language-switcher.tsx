import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/lib/i18n";
import { resolveSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/lib/language";

const languageLabels: Record<SupportedLanguage, string> = { en: "English", ar: "العربية" };

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const activeLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return <div className="inline-flex rounded-md border bg-white p-0.5" role="group" aria-label={t("navigation.languageSwitcher")}>
    {supportedLanguages.map((language) => <button
      type="button"
      key={language}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      aria-pressed={activeLanguage === language}
      className={`min-h-8 rounded px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${activeLanguage === language ? "bg-foreground text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      onClick={() => void changeAppLanguage(language)}
    >{languageLabels[language]}</button>)}
  </div>;
}
