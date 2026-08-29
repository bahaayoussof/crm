import { useTranslation } from "react-i18next";

export function FoundationPage() {
  const { t } = useTranslation();
  return <main className="grid h-full place-items-center p-6"><div className="text-center"><h1 className="text-2xl font-semibold text-foreground">{t("app.title")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("app.foundationReady")}</p></div></main>;
}
