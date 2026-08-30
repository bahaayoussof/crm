import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getLocalizedUserError } from "./user-error";
import { useUpdateUser } from "./user-hooks";
import { SpinnerIcon, UserRoundCheckIcon, UserRoundXIcon } from "./user-icons";
import type { User } from "./user.types";

const TRIGGER_BASE =
  "inline-flex size-8 items-center justify-center rounded-lg border transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60";
const TRIGGER_NEUTRAL = "border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:ring-ring";
const TRIGGER_DANGER = "border-danger-soft text-danger-foreground hover:bg-danger-soft focus-visible:ring-danger/30";

interface UserStatusConfirmProps {
  user: User;
  disabled: boolean;
  disabledReason?: string;
  open: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
  hideTrigger?: boolean;
  externalTriggerRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Centered modal confirmation dialog for User deactivation / reactivation.
 *
 * Renders portalled onto `document.body` with a full-viewport backdrop overlay,
 * centered horizontally and vertically in the browser viewport.
 */
export function UserStatusConfirm({
  user,
  disabled,
  disabledReason,
  open,
  onRequestOpen,
  onRequestClose,
  hideTrigger = false,
  externalTriggerRef,
}: UserStatusConfirmProps) {
  const { t } = useTranslation();
  const rootId = useId();
  const panelId = `${rootId}-panel`;
  const titleId = `${rootId}-title`;
  const descId = `${rootId}-desc`;

  const update = useUpdateUser(user.id);
  const [error, setError] = useState<string | null>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const contentRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const targetRef = useRef(user);

  const deactivating = user.isActive;

  const requestClose = useCallback(() => {
    if (!update.isPending) onRequestClose();
  }, [onRequestClose, update.isPending]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      targetRef.current = user;
      setError(null);
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

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        requestClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        requestClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  const onConfirm = async () => {
    setError(null);
    try {
      await update.mutateAsync({ isActive: !targetRef.current.isActive });
      onRequestClose();
    } catch (mutationError) {
      setError(getLocalizedUserError(mutationError, t("users.statusChangeError"), t));
    }
  };

  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [cancelRef.current, confirmRef.current].filter(
      (el): el is HTMLButtonElement => Boolean(el) && !el!.disabled
    );
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const StatusIcon = deactivating ? UserRoundXIcon : UserRoundCheckIcon;
  const statusLabel = deactivating ? t("users.deactivateAction") : t("users.reactivateAction");
  const title = deactivating
    ? t("users.deactivateConfirmTitle", { name: user.name })
    : t("users.reactivateConfirmTitle", { name: user.name });

  const panel = open
    ? createPortal(
        <div
          id={panelId}
          data-user-status-confirm=""
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={deactivating ? descId : undefined}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0 duration-150"
          onKeyDown={onPanelKeyDown}
        >
          <div
            ref={contentRef}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-flyout animate-in zoom-in-95 fade-in-0 duration-150"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-5 text-start">
              <h3 id={titleId} className="text-base font-semibold leading-6 text-foreground" dir="auto">
                {title}
              </h3>
              {deactivating && (
                <p id={descId} className="mt-2 text-sm leading-5 text-muted-foreground" dir="auto">
                  {t("users.deactivateConsequence")}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-2 text-sm text-danger-foreground">
                  {error}
                </p>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface-secondary px-5 py-3">
              <button
                ref={cancelRef}
                type="button"
                className="button-ghost min-h-9 px-4 py-2 text-xs font-medium"
                disabled={update.isPending}
                onClick={requestClose}
              >
                {t("common.cancel")}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={`${deactivating ? "button-danger" : "button-link"} min-h-9 gap-1.5 px-4 py-2 text-xs font-medium`}
                disabled={update.isPending}
                onClick={onConfirm}
              >
                {update.isPending ? (
                  <>
                    <SpinnerIcon className="size-3.5" />
                    {deactivating ? t("users.deactivating") : t("users.reactivating")}
                  </>
                ) : error ? (
                  t("common.retry")
                ) : deactivating ? (
                  t("users.confirmDeactivate")
                ) : (
                  t("users.confirmReactivate")
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  if (hideTrigger) {
    return <>{panel}</>;
  }

  return (
    <>
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
    </>
  );
}
