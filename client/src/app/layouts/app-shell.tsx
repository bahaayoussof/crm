import { useEffect, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/features/auth/auth-state";
import { NotificationBell } from "@/features/notifications/notification-bell";
import type { ProtectedAudience } from "@/features/auth/auth-routing";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { LogoutIcon } from "./nav-icons";
import { getNavigationSections, isNavItemShadowed } from "./nav-config";
import { Sidebar } from "./sidebar/sidebar";

function getStoredCollapsed(): boolean {
  try {
    return localStorage.getItem("crm_sidebar_collapsed") === "true";
  } catch {
    return false;
  }
}

export function AppShell({ audience, children }: PropsWithChildren<{ audience: ProtectedAudience }>) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(getStoredCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("crm_sidebar_collapsed", String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || user.name.slice(0, 2).toUpperCase()
    : "U";

  // Single source of truth for navigation — shared by the desktop `Sidebar`
  // and the responsive drawer below. Role/audience gating lives in nav-config.
  const navItems = getNavigationSections(user, audience).flatMap((section) => section.items);
  const isInternal = audience === "internal";

  return (
    <div
      className={cn(
        "min-h-[100dvh] bg-background text-foreground lg:grid lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden transition-[grid-template-columns] duration-200 ease-out",
        collapsed ? "lg:grid-cols-[68px_minmax(0,1fr)]" : "lg:grid-cols-[240px_minmax(0,1fr)]"
      )}
    >
      {/* Desktop Redesigned Sidebar */}
      <Sidebar
        user={user}
        audience={audience}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onLogout={signOut}
      />

      {/* Main Workspace Canvas */}
      <div className="min-w-0 flex flex-col lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xs">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            {/* Mobile Header: Hamburger Menu + Logo + Gracefully Truncated Title */}
            <div className="min-w-0 lg:hidden flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Open mobile navigation"
              >
                <Menu className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex size-7.5 shrink-0 items-center justify-center rounded-md bg-foreground text-background font-bold text-xs shadow-2xs">
                  CS
                </div>
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {t("app.title")}
                </span>
              </div>
            </div>

            {/* Desktop Header: Workspace Status Indicator */}
            <div className="hidden min-w-0 lg:flex lg:items-center lg:gap-3">
              <div className="flex size-2 rounded-full bg-success shadow-xs" />
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground" dir="auto">
                  {user?.name}
                </span>{" "}
                · {t(isInternal ? "navigation.workspaceContext" : "navigation.portalContext")}
              </p>
            </div>

            {/* Desktop Header Right Controls */}
            <div className="hidden lg:flex shrink-0 items-center gap-3">
              {isInternal && <NotificationBell />}
              <LanguageSwitcher />
            </div>

            {/* Mobile Header Right Profile Avatar Button */}
            <div className="lg:hidden flex shrink-0 items-center gap-2">
              {isInternal && <NotificationBell />}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={user?.name || "User menu"}
                className="flex size-8.5 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-foreground shadow-2xs transition-colors hover:border-border-strong hover:bg-surface-hover outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {userInitials}
              </button>
            </div>
          </div>
        </header>

        {/* Page Content — the primary vertical scroll container on desktop */}
        <div className="min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto">{children}</div>
      </div>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in-0"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("navigation.primary")}
              className="fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] bg-surface border-e border-border shadow-2xl flex flex-col justify-between p-4 overflow-y-auto animate-in slide-in-from-start duration-200"
            >
              {/* Drawer Top Header */}
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

                {/* Drawer Navigation Links */}
                <nav className="space-y-1" aria-label={t("navigation.primary")}>
                  {navItems.map((item) => {
                    const label = t(`navigation.${item.key}`, { defaultValue: item.label || item.key });
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
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
                    );
                  })}
                </nav>
              </div>

              {/* Drawer Bottom: Language + Theme + Profile + Logout */}
              <div className="border-t border-border-subtle pt-4 mt-6 space-y-3">
                {/* Appearance Theme Switcher */}
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
    </div>
  );
}
