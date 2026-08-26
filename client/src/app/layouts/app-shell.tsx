import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useAuth } from "@/features/auth/auth-state";
import type { ProtectedAudience } from "@/features/auth/auth-routing";

const internalNavigation = [
  { to: "/dashboard", key: "dashboard" },
  { to: "/tickets", key: "tickets" },
  { to: "/customers", key: "customers" },
  { to: "/knowledge-base", key: "knowledgeBase" },
] as const;

export function AppShell({ audience, children }: PropsWithChildren<{ audience: ProtectedAudience }>) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  if (audience === "customer") {
    return <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center gap-x-3 px-4 py-2 sm:px-6 lg:px-8">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">{t("app.title")}</span>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden text-end sm:block"><p className="max-w-36 truncate text-sm font-medium" dir="auto">{user?.name}</p><p className="text-xs text-muted-foreground">{t("navigation.portalContext")}</p></div>
            <LanguageSwitcher />
            <button className="button-ghost px-2 text-xs" onClick={signOut}>{t("auth.logout")}</button>
          </div>
          <nav className="order-last mt-1 flex h-8 w-full items-end" aria-label={t("navigation.primary")}>
            <NavLink to="/portal" className={({ isActive }) => `h-8 border-b-2 px-0.5 text-xs font-medium leading-7 ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t("navigation.portalHome")}</NavLink>
          </nav>
        </div>
      </header>
      {children}
    </div>;
  }

  const navigation = internalNavigation;

  return <div className="min-h-[100dvh] bg-background lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    <aside className="hidden border-e bg-white lg:flex lg:min-h-[100dvh] lg:flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <span className="text-sm font-semibold tracking-tight">{t("app.title")}</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5" aria-label={t("navigation.primary")}>
        {navigation.map((item) => <ShellNavLink key={item.to} to={item.to} label={t(`navigation.${item.key}`)} />)}
      </nav>
      <div className="border-t p-4">
        <p className="truncate text-sm font-medium" dir="auto">{user?.name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{user?.email}</p>
        <button className="mt-4 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" onClick={signOut}>{t("auth.logout")}</button>
      </div>
    </aside>

    <div className="min-w-0">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="flex min-h-16 items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold tracking-tight">{t("app.title")}</p>
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-medium" dir="auto">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{t("navigation.workspaceContext")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
            <button className="button-ghost px-2 text-xs lg:hidden" onClick={signOut}>{t("auth.logout")}</button>
          </div>
        </div>
        <nav className="flex min-h-9 items-end gap-5 overflow-x-auto px-4 sm:px-6 lg:hidden" aria-label={t("navigation.primary")}>
          {navigation.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `h-9 shrink-0 border-b-2 px-0.5 text-xs font-medium leading-8 ${isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t(`navigation.${item.key}`)}</NavLink>)}
        </nav>
      </header>
      {children}
    </div>
  </div>;
}

function ShellNavLink({ to, label }: { to: string; label: string }) {
  return <NavLink to={to} className={({ isActive }) => `flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</NavLink>;
}
