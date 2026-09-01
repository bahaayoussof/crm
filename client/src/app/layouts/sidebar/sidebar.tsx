import { useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Tooltip } from "@/components/ui/tooltip";
import type { AuthUser } from "@/features/auth/auth.types";
import type { ProtectedAudience } from "@/features/auth/auth-routing";
import { createReportNavTarget } from "@/features/reports/hooks/use-reports-range-params";
import { cn } from "@/lib/utils";
import { CollapseIcon, ExpandIcon } from "../nav-icons";
import { getFlatNavItems, getNavigationSections, isNavItemShadowed } from "../nav-config";
import { SidebarFlyout } from "./sidebar-flyout";
import { SidebarUserMenu } from "./sidebar-user-menu";

interface SidebarProps {
  user: AuthUser | null;
  audience: ProtectedAudience;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
}

export function Sidebar({ user, audience, collapsed, onToggleCollapsed, onLogout }: SidebarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [activeFlyoutKey, setActiveFlyoutKey] = useState<string | null>(null);


  const sections = getNavigationSections(user, audience);
  const flatItems = getFlatNavItems(sections);

  return (
    <aside
      className={cn(
        // No `overflow-hidden` here: the floating collapse toggle intentionally
        // sticks out past the edge. Height containment comes from the fixed-height
        // AppShell row + the nav below being the only growable child (min-h-0 +
        // overflow-y-auto), so the aside itself never needs to clip or scroll.
        "relative hidden lg:flex lg:flex-col lg:h-full lg:min-h-0 select-none bg-sidebar border-e border-sidebar-border transition-all duration-200 ease-out z-40",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Floating Outer Edge Collapse Toggle */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t("navigation.expandSidebar") : t("navigation.collapseSidebar")}
        className={cn(
          "absolute end-[-12px] top-4.5 z-50 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground shadow-xs transition-colors outline-none",
          "hover:border-border-strong hover:bg-surface-hover hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-primary/30"
        )}
      >
        {collapsed ? (
          <ExpandIcon className="size-3.5 rtl:rotate-180" />
        ) : (
          <CollapseIcon className="size-3.5 rtl:rotate-180" />
        )}
      </button>

      {/* Brand Header — pinned; stays visible while the nav scrolls under it */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center transition-all duration-200",
          collapsed ? "w-full justify-center px-0" : "px-4"
        )}
      >
        <div className={cn("flex items-center overflow-hidden", collapsed ? "justify-center" : "gap-2.5")}>
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background font-bold text-xs shadow-2xs"
            title={collapsed ? t("app.title") : undefined}
          >
            CS
          </div>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {t("app.title")}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Sections — the ONLY scroll region, and only when it overflows */}
      <nav
        className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pt-2 pb-4 space-y-3"
        aria-label={t("navigation.primary")}
      >
          {sections.map((section, sectionIdx) => (
            <div key={section.id} className="w-full">
              {/* Section Header */}
              {!collapsed ? (
                <div className="px-3 pb-1 pt-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {section.labelKey ? t(section.labelKey, { defaultValue: section.label }) : section.label}
                  </span>
                </div>
              ) : (
                sectionIdx > 0 && (
                  <div className="w-full flex items-center justify-center py-1.5" aria-hidden="true">
                    <div className="w-7 h-[1px] bg-border-subtle" />
                  </div>
                )
              )}

              {/* Section Items */}
              <div className={cn("space-y-0.5", collapsed ? "w-full space-y-1 px-0" : "px-2.5")}>
                {section.items.map((item) => {
                  const label = t(`navigation.${item.key}`, { defaultValue: item.label || item.key });
                  const Icon = item.icon;
                  const hasChildren = Boolean(item.children && item.children.length > 0);

                  return (
                    <div key={item.to} className={cn("relative w-full", collapsed && "flex items-center justify-center")}>
                      <Tooltip content={label} enabled={collapsed && activeFlyoutKey !== item.key} side="right" className={collapsed ? "w-full flex justify-center" : undefined}>
                        <NavLink
                          to={item.to.startsWith("/reports") ? createReportNavTarget(item.to, searchParams) : item.to}
                          end={item.end || isNavItemShadowed(item, flatItems, pathname)}
                          aria-label={collapsed ? label : undefined}
                          onClick={() => {
                            if (collapsed && hasChildren) {
                              setActiveFlyoutKey((prev) => (prev === item.key ? null : item.key));
                            }
                          }}
                          className={({ isActive }) =>
                            cn(
                              "group flex items-center rounded-lg text-xs font-medium transition-colors duration-150 outline-none select-none",
                              "focus-visible:ring-2 focus-visible:ring-primary/30",
                              collapsed
                                ? "size-9 justify-center"
                                : "h-8.5 w-full gap-2.5 px-2.5",
                              isActive
                                ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                                : "text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={cn(
                                  "size-4 shrink-0 transition-colors",
                                  isActive
                                    ? "text-sidebar-foreground"
                                    : "text-muted-foreground group-hover:text-sidebar-foreground"
                                )}
                              />
                              {!collapsed && <span className="truncate">{label}</span>}
                              {!collapsed && item.badge !== undefined && (
                                <span className="ms-auto rounded-full bg-surface-subtle border border-border px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                                  {item.badge}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </Tooltip>

                      {/* Expanded Submenu Hierarchy */}
                      {!collapsed && hasChildren && item.children && (
                        <div className="ms-5 ps-2 border-s border-border-subtle my-0.5 space-y-0.5">
                          {item.children.map((child) => {
                            const childLabel = child.label || t(`navigation.${child.key}`, { defaultValue: child.key });
                            return (
                              <NavLink
                                key={child.to}
                                to={child.to.startsWith("/reports") ? createReportNavTarget(child.to, searchParams) : child.to}
                                end={child.end}
                                className={({ isActive }) =>
                                  cn(
                                    "flex h-7 w-full items-center justify-between rounded-md px-2 text-[11px] font-medium transition-colors outline-none",
                                    "focus-visible:ring-2 focus-visible:ring-primary/30",
                                    isActive
                                      ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                                      : "text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
                                  )
                                }
                              >
                                <span className="truncate">{childLabel}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}


                      {/* Collapsed Flyout Submenu */}
                      {collapsed && hasChildren && item.children && (
                        <SidebarFlyout
                          open={activeFlyoutKey === item.key}
                          onDismiss={() => setActiveFlyoutKey(null)}
                          parentLabel={label}
                          childrenItems={item.children}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>

      {/* Bottom Half: Pinned User Profile Menu — anchored at the viewport bottom */}
      <div
        data-sidebar-profile
        className={cn(
          "w-full shrink-0 border-t border-sidebar-border bg-sidebar",
          collapsed ? "py-2 px-0 flex items-center justify-center" : "p-3"
        )}
      >
        <SidebarUserMenu user={user} audience={audience} collapsed={collapsed} onLogout={onLogout} />
      </div>
    </aside>
  );
}
