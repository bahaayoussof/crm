import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { BrandLogo } from "@/components/shared/brand-logo";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="h-full overflow-y-auto bg-background px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <BrandLogo variant="full" className="h-8 sm:h-9" />
        <LanguageSwitcher />
      </div>
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] w-full max-w-5xl place-items-center py-8 sm:min-h-[calc(100dvh-7rem)]">
        <section className="w-full max-w-[27rem] rounded-xl border border-border bg-surface px-6 py-7 shadow-subtle sm:px-8 sm:py-8" aria-labelledby="auth-title">
          <div className="border-b border-border pb-5">
            <h1 id="auth-title" className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="mt-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
