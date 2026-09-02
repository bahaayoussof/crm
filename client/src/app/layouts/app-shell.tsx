import { useEffect, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/features/auth/auth-state";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { ProtectedAudience } from "@/features/auth/auth-routing";
import { createReportNavTarget } from "@/features/reports/hooks/use-reports-range-params";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { LogoutIcon } from "./nav-icons";
import { getNavigationSections, isNavItemShadowed } from "./nav-config";
import { Sidebar } from "./sidebar/sidebar";
import { CustomerAiWidget } from "@/features/customer-ai/customer-ai-widget";

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem("crm_sidebar_collapsed") === "true";
  } catch {
    return false;
  }
}

export function AppShell({ audience, children }: PropsWithChildren<{ audience: ProtectedAudience }>) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(getStoredCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem("crm_sidebar_collapsed", String(collapsed));
    } catch {
      // Storage unavailable
    }
  }, [collapsed]);

  const sections = getNavigationSections(user, audience);
  const navItems = sections.flatMap((section) => section.items);
  const isInternal = audience === "internal";

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "??";

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground lg:grid lg:grid-rows-1 transition-[grid-template-columns] duration-200 ease-out",
        collapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"
      )}
    >

      <Sidebar
        user={user}
        audience={audience}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        onLogout={signOut}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          role="banner"
          aria-label="Application header"
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-surface px-4 shadow-2xs lg:px-6"
        >
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background font-bold text-xs">
                  CS
                </div>
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {t("app.title")}
                </span>
              </div>
            </div>

            <div className="hidden min-w-0 lg:flex lg:items-center lg:gap-3">
              <div className="flex size-2 rounded-full bg-success shadow-xs" />
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground" dir="auto">
                  {user?.name}
                </span>{" "}
                · {t(isInternal ? "navigation.workspaceContext" : "navigation.portalContext")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {isInternal && <NotificationBell />}
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <div data-app-content-scroll className="min-w-0 min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("navigation.primary")}
              className="fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] bg-surface border-e border-border shadow-2xl flex flex-col justify-between p-4 overflow-y-auto animate-in slide-in-from-start duration-200"
            >
              <div>
                <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3 mb-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background font-bold text-xs shadow-2xs">
                      CS
                    </div>
                    <span className="truncate text-sm font-bold tracking-tight text-foreground">
                      {t("app.title")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-subtle hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="Close menu"
                  >
                    <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>

                <nav className="space-y-1" aria-label={t("navigation.primary")}>
                  {navItems.map((item) => {
                    const label = t(`navigation.${item.key}`, { defaultValue: item.label || item.key });
                    const Icon = item.icon;
                    const hasChildren = Boolean(item.children && item.children.length > 0);

                    return (
                      <div key={item.to} className="space-y-1">
                        <NavLink
                          to={item.to.startsWith("/reports") ? createReportNavTarget(item.to, searchParams) : item.to}
                          end={item.end || isNavItemShadowed(item, navItems, pathname)}
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none",
                              "focus-visible:ring-2 focus-visible:ring-primary/30",
                              isActive
                                ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                                : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                            )
                          }
                        >
                          <Icon className="size-4.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{label}</span>
                        </NavLink>

                        {hasChildren && item.children && (
                          <div className="ms-6 ps-2.5 border-s border-border-subtle space-y-1 my-1">
                            {item.children.map((child) => {
                              const childLabel = child.label || t(`navigation.${child.key}`, { defaultValue: child.key });
                              return (
                                <NavLink
                                  key={child.to}
                                  to={child.to.startsWith("/reports") ? createReportNavTarget(child.to, searchParams) : child.to}
                                  end={child.end}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={({ isActive }) =>
                                    cn(
                                      "flex min-h-8 w-full items-center justify-between rounded-md px-2 text-xs font-medium transition-colors outline-none",
                                      "focus-visible:ring-2 focus-visible:ring-primary/30",
                                      isActive
                                        ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                                        : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
                                    )
                                  }
                                >
                                  <span className="truncate">{childLabel}</span>
                                </NavLink>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-border-subtle pt-4 mt-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("theme.title")}
                  </span>
                  <ThemeToggle />
                </div>

                {/* Language Switcher */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("navigation.languageSwitcher")}
                  </span>
                  <LanguageSwitcher />
                </div>

                {/* User Profile Card */}
                <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface-subtle/50 p-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-bold text-foreground">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground" dir="auto">
                      {user?.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
                      {user?.email}
                    </p>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-subtle hover:text-danger-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                >
                  <LogoutIcon className="size-4" />
                  <span>{t("auth.logout")}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {audience === "customer" && <CustomerAiWidget />}
    </div>
  );
}
