import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { t } = useTranslation();

  return <main className="min-h-[100dvh] bg-muted/60 px-4 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
      <p className="text-sm font-semibold tracking-tight text-foreground">{t("app.title")}</p>
      <LanguageSwitcher />
    </div>
    <div className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-5xl place-items-center py-8 sm:min-h-[calc(100dvh-7rem)]">
      <section className="w-full max-w-[27rem] rounded-lg border bg-white px-5 py-6 sm:px-8 sm:py-8" aria-labelledby="auth-title">
        <div className="border-b pb-5">
          <h1 id="auth-title" className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {children}
      </section>
    </div>
  </main>;
}
