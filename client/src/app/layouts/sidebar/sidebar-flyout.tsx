import { createPortal } from "react-dom";
import { NavLink, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { createReportNavTarget } from "@/features/reports/hooks/use-reports-range-params";
import { cn } from "@/lib/utils";
import type { NavChildItem } from "./sidebar-types";

interface SidebarFlyoutProps {
  open: boolean;
  onDismiss: () => void;
  parentLabel: string;
  childrenItems: NavChildItem[];
}

export function SidebarFlyout({ open, onDismiss, parentLabel, childrenItems }: SidebarFlyoutProps) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const { panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss,
    align: "start",
    width: 180,
    gap: 8,
  });

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={parentLabel}
      style={style}
      className="fixed z-50 min-w-[170px] max-w-[210px] rounded-xl border border-border bg-surface p-1.5 shadow-flyout animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
    >
      <div className="border-b border-border-subtle px-2.5 py-1.5 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {parentLabel}
        </span>
      </div>
      <div className="space-y-0.5">
        {childrenItems.map((child) => {
          const childLabel = child.label || t(`navigation.${child.key}`, { defaultValue: child.key });
          return (
            <NavLink
              key={child.to}
              to={child.to.startsWith("/reports") ? createReportNavTarget(child.to, searchParams) : child.to}
              end={child.end}
              onClick={onDismiss}
              className={({ isActive }) =>
                cn(
                  "flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-xs font-medium transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-primary/30",
                  isActive
                    ? "bg-sidebar-active text-sidebar-foreground font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
                )
              }
            >
              <span className="truncate">{childLabel}</span>
              {child.badge !== undefined && (
                <span className="ms-1.5 rounded-full bg-surface-subtle border border-border px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                  {child.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

