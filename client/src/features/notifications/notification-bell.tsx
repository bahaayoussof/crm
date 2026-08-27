import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Bell, CheckCheck, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { cn } from "@/lib/utils";
import { useMarkAllRead, useMarkNotificationRead, useNotifications, useUnreadCount } from "./notification-hooks";
import type { Notification } from "./notification.types";
import { formatRelativeTime } from "./notification-time";

// ---------------------------------------------------------------------------
// NotificationBell — trigger button with unread badge, mounts the panel
// ---------------------------------------------------------------------------
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: countData } = useUnreadCount();
  const unreadCount = countData?.data?.count ?? 0;

  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    onDismiss: () => setOpen(false),
    align: "end",
    width: 360,
    minWidth: 300,
    maxWidth: 400,
    maxHeight: 480,
    minHeight: 160,
  });

  const badgeLabel =
    unreadCount === 0 ? "" : unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id="notification-bell"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("notifications.bellLabel", { count: unreadCount })}
        aria-expanded={open}
        aria-controls={open ? "notification-panel" : undefined}
        aria-haspopup="listbox"
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors outline-none",
          "hover:bg-surface-hover hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-primary/30",
          open && "bg-surface-hover text-foreground"
        )}
      >
        <Bell className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -end-1 flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground h-[18px]"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <NotificationPanel
            panelRef={panelRef}
            style={style}
            unreadCount={unreadCount}
            locale={i18n.language}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

// ---------------------------------------------------------------------------
// NotificationPanel — portalled dropdown with list of 20 most recent
// ---------------------------------------------------------------------------
interface NotificationPanelProps {
  panelRef: React.RefObject<HTMLDivElement | null>;
  style: React.CSSProperties;
  unreadCount: number;
  locale: string;
  onClose: () => void;
}

function NotificationPanel({ panelRef, style, unreadCount, locale, onClose }: NotificationPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useNotifications({ limit: 20, page: 1 });
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  // Focus the panel on open
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      (panelRef.current?.querySelector("[data-autofocus]") as HTMLElement | null)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [panelRef]);

  function handleNotificationClick(n: Notification) {
    if (!n.readAt) markOne.mutate(n.id);
    onClose();
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
  }

  return (
    <div
      ref={panelRef}
      id="notification-panel"
      role="dialog"
      aria-label={t("notifications.title")}
      aria-modal="false"
      className="fixed z-50 flex flex-col rounded-lg border border-border bg-surface shadow-lg overflow-hidden"
      style={style}
      data-notification-panel
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">{t("notifications.title")}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-autofocus
            onClick={() => markAll.mutate()}
            disabled={unreadCount === 0 || markAll.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              unreadCount === 0
                ? "cursor-not-allowed text-muted-foreground/40"
                : "text-primary hover:bg-primary/10"
            )}
            aria-label={t("notifications.markAllRead")}
          >
            <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            {t("notifications.markAllRead")}
          </button>
        </div>
      </div>

      {/* Body — scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3 animate-pulse">
                <div className="mt-1 size-2 shrink-0 rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-muted" />
                  <div className="h-2.5 w-full rounded bg-muted" />
                  <div className="h-2 w-1/4 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t("notifications.error")}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs text-primary hover:underline outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && (data?.data.length ?? 0) === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <Bell className="size-8 text-muted-foreground/30" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
          </div>
        )}

        {!isLoading && !isError && (data?.data.length ?? 0) > 0 && (
          <ul role="listbox" aria-label={t("notifications.title")}>
            {data!.data.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                locale={locale}
                isPending={markOne.isPending && markOne.variables === n.id}
                onClick={() => handleNotificationClick(n)}
              />
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// NotificationRow — single item in the panel list
// ---------------------------------------------------------------------------
interface NotificationRowProps {
  notification: Notification;
  locale: string;
  isPending: boolean;
  onClick: () => void;
}

function NotificationRow({ notification: n, locale, isPending, onClick }: NotificationRowProps) {
  const { t } = useTranslation();
  const isUnread = n.readAt === null;

  return (
    <li role="option" aria-selected={false}>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          "flex w-full gap-3 px-4 py-3 text-start transition-colors outline-none",
          "hover:bg-surface-subtle focus-visible:bg-surface-subtle focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-primary/30",
          isUnread ? "bg-primary/[0.04]" : "bg-transparent",
          isPending && "opacity-60 pointer-events-none"
        )}
        aria-label={`${n.title}${isUnread ? ` — ${t("notifications.unread")}` : ""}`}
      >
        {/* Unread indicator — NOT color-only: also announced via aria-label */}
        <span className="mt-[5px] shrink-0">
          {isUnread ? (
            <Circle className="size-2 fill-primary text-primary" strokeWidth={0} aria-hidden="true" />
          ) : (
            <span className="block size-2" aria-hidden="true" />
          )}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-semibold leading-snug text-foreground", !isUnread && "font-medium text-muted-foreground")}>
            {n.title}
          </p>
          {/* Two-line message clamp with overflow-wrap for long unbroken strings */}
          <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            {n.message}
          </p>
          <time
            dateTime={n.createdAt}
            className="mt-1 block text-[10px] text-muted-foreground/70"
            title={new Date(n.createdAt).toLocaleString(locale)}
          >
            {formatRelativeTime(n.createdAt, locale)}
          </time>
        </div>
      </button>
    </li>
  );
}
