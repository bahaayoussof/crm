import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "@/lib/i18n";
import { resolveSupportedLanguage, supportedLanguages, type SupportedLanguage } from "@/lib/language";
import { cn } from "@/lib/utils";

const languageLabels: Record<SupportedLanguage, string> = { en: "English", ar: "العربية" };

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const activeLanguage = resolveSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div
      className={cn("inline-flex items-center rounded-lg border border-border bg-surface-subtle p-0.5 shadow-xs", className)}
      role="group"
      aria-label={t("navigation.languageSwitcher")}
    >
      {supportedLanguages.map((language) => (
        <button
          type="button"
          key={language}
          aria-pressed={activeLanguage === language}
          className={cn(
            "min-h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-all duration-150 select-none",
            "focus-visible:ring-2 focus-visible:ring-primary/30",
            activeLanguage === language
              ? "bg-surface text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => void changeAppLanguage(language)}
        >
          <span lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
            {languageLabels[language]}
          </span>
        </button>
      ))}
    </div>
  );
}
