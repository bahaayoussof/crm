import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { Tooltip } from "@/components/ui/tooltip";
import type { AuthUser } from "@/features/auth/auth.types";
import { cn } from "@/lib/utils";
import { ChevronDownNavIcon, LogoutIcon } from "../nav-icons";

interface SidebarUserMenuProps {
  user: AuthUser | null;
  collapsed: boolean;
  onLogout: () => void;
}

export function SidebarUserMenu({ user, collapsed, onLogout }: SidebarUserMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: () => setOpen(false),
    align: collapsed ? "start" : "end",
    width: 220,
    gap: 8,
  });

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || user.name.slice(0, 2).toUpperCase()
    : "U";

  const handleSignOut = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <div className={collapsed ? "w-full flex items-center justify-center" : "w-full"}>
      {collapsed ? (
        <Tooltip content={user?.name || t("auth.userProfile")} side="right" enabled={!open} className="w-full flex justify-center">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={user?.name || t("auth.userProfile")}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xs font-semibold text-foreground shadow-2xs transition-all duration-150 outline-none select-none",
              "hover:border-border-strong hover:bg-surface-hover",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              open && "ring-2 ring-primary/25 border-border-strong bg-surface-active"
            )}
          >
            {userInitials}
          </button>
        </Tooltip>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={user?.name}
          className={cn(
            "group flex w-full items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-surface/60 p-1.5 text-start transition-all duration-150 outline-none select-none",
            "hover:border-border-strong hover:bg-surface-hover hover:shadow-2xs",
            "focus-visible:ring-2 focus-visible:ring-primary/30",
            open && "border-border-strong bg-surface-active shadow-2xs"
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-subtle text-[11px] font-bold text-foreground">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground leading-tight" dir="auto">
                {user?.name}
              </p>
              <p className="truncate text-[10px] font-medium text-muted-foreground capitalize leading-tight mt-0.5">
                {user?.role?.toLowerCase()}
              </p>
            </div>
          </div>
          <ChevronDownNavIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180 text-foreground"
            )}
          />
        </button>
      )}

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-orientation="vertical"
            style={style}
            className="fixed z-50 min-w-[200px] rounded-xl border border-border bg-surface p-1.5 shadow-flyout animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
          >
            {/* User Meta Card Header */}
            <div className="border-b border-border-subtle px-2.5 py-2">
              <p className="truncate text-xs font-semibold text-foreground" dir="auto">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
                {user?.email}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-md bg-surface-subtle border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                  {user?.role?.toLowerCase()}
                </span>
              </div>
            </div>

            {/* Actions List */}
            <div className="pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-subtle hover:text-danger-foreground focus-visible:outline-none focus-visible:bg-danger-subtle"
              >
                <LogoutIcon className="size-3.5" />
                <span>{t("auth.logout")}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
