import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { getLocalizedUserError } from "./user-error";
import { useUpdateUser } from "./user-hooks";
import { SpinnerIcon, UserRoundCheckIcon, UserRoundXIcon } from "./user-icons";
import type { User } from "./user.types";

const TRIGGER_BASE =
  "inline-flex size-9 items-center justify-center rounded-md border transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
const TRIGGER_NEUTRAL = "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-primary";
const TRIGGER_DANGER = "border-red-200 text-red-700 hover:bg-red-50 focus-visible:ring-red-300";

interface UserStatusConfirmProps {
  user: User;
  disabled: boolean;
  disabledReason?: string;
  open: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
}

/**
 * Deactivate / Reactivate trigger + its confirmation popover.
 *
 * The confirmation is rendered through a portal on `document.body` (never inside
 * the Users table or its `overflow-x-auto` wrapper) and pinned to the trigger's
 * logical end via `useAnchoredPopover` — so it floats above the table, flips
 * above when space is short, clamps to the viewport, and never adds a scrollbar
 * to the table. Single-open coordination and stale-state closing on
 * filter/pagination are owned by `UserTable` through the `open` / `onRequest*`
 * props (keyed by stable user id).
 */
export function UserStatusConfirm({ user, disabled, disabledReason, open, onRequestOpen, onRequestClose }: UserStatusConfirmProps) {
  const { t } = useTranslation();
  const rootId = useId();
  const panelId = `${rootId}-panel`;
  const titleId = `${rootId}-title`;
  const descId = `${rootId}-desc`;

  const update = useUpdateUser(user.id);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  // The user targeted when the popover opened — Confirm always acts on this,
  // regardless of any row reshuffle from filtering/pagination behind the portal.
  const targetRef = useRef(user);

  const deactivating = user.isActive;

  const { triggerRef, panelRef, position, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    align: "end",
    onDismiss: () => { if (!update.isPending) onRequestClose(); },
  });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      targetRef.current = user;
      setError(null);
      // focus the safest first action once the portalled panel is placed
      const id = window.requestAnimationFrame(() => cancelRef.current?.focus());
      wasOpenRef.current = true;
      return () => window.cancelAnimationFrame(id);
    }
    if (!open && wasOpenRef.current) {
      wasOpenRef.current = false;
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
    }
  }, [open, user, triggerRef]);

  const requestClose = () => { if (!update.isPending) onRequestClose(); };

  const onConfirm = async () => {
    setError(null);
    try {
      await update.mutateAsync({ isActive: !targetRef.current.isActive });
      onRequestClose(); // row re-renders from cache invalidation; focus returns to the (relabelled) trigger
    } catch (mutationError) {
      setError(getLocalizedUserError(mutationError, t("users.statusChangeError"), t));
    }
  };

  // Minimal focus trap: Cancel <-> Confirm are the only stops.
  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); requestClose(); return; }
    if (event.key !== "Tab") return;
    const focusables = [cancelRef.current, confirmRef.current].filter((el): el is HTMLButtonElement => Boolean(el) && !el!.disabled);
    if (focusables.length === 0) { event.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
  };

  const StatusIcon = deactivating ? UserRoundXIcon : UserRoundCheckIcon;
  const statusLabel = deactivating ? t("users.deactivateAction") : t("users.reactivateAction");
  const title = deactivating
    ? t("users.deactivateConfirmTitle", { name: user.name })
    : t("users.reactivateConfirmTitle", { name: user.name });

  const panel = open && position
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          data-user-status-confirm=""
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={deactivating ? descId : undefined}
          className="fixed z-50 flex flex-col overflow-hidden rounded-md border border-border bg-white text-start shadow-lg"
          style={style}
          onKeyDown={onPanelKeyDown}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <p id={titleId} className="text-sm font-medium leading-5 text-foreground" dir="auto">{title}</p>
            {deactivating && <p id={descId} className="mt-1 text-xs leading-5 text-muted-foreground">{t("users.deactivateConsequence")}</p>}
            {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-muted/30 p-2.5">
            <button ref={cancelRef} type="button" className="button-ghost min-h-9 w-auto px-3 py-1 text-xs" disabled={update.isPending} onClick={requestClose}>
              {t("common.cancel")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className={`${deactivating ? "button-danger" : "button-link"} min-h-9 w-auto gap-1.5 px-3 py-1 text-xs`}
              disabled={update.isPending}
              onClick={onConfirm}
            >
              {update.isPending
                ? <><SpinnerIcon className="size-3.5" />{deactivating ? t("users.deactivating") : t("users.reactivating")}</>
                : error
                  ? t("common.retry")
                  : deactivating ? t("users.confirmDeactivate") : t("users.confirmReactivate")}
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`${TRIGGER_BASE} ${deactivating ? TRIGGER_DANGER : TRIGGER_NEUTRAL}`}
      aria-label={statusLabel}
      title={disabledReason ?? statusLabel}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      disabled={disabled}
      onClick={() => (open ? requestClose() : onRequestOpen())}
    >
      <StatusIcon />
    </button>
    {panel}
  </>;
}
