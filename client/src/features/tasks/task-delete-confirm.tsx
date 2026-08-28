import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { getLocalizedTaskError } from "./task-error";
import { useDeleteTask } from "./task-hooks";
import { SpinnerIcon, TrashIcon } from "./task-icons";
import type { Task } from "./task.types";

const TRIGGER =
  "inline-flex size-8 items-center justify-center rounded-lg border border-danger-soft text-danger-foreground transition-colors " +
  "hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

interface TaskDeleteConfirmProps {
  task: Task;
  open: boolean;
  onRequestOpen: () => void;
  onRequestClose: () => void;
}

/**
 * Delete trigger + its confirmation popover for a task table row.
 *
 * The confirmation is rendered through a portal on `document.body` (never inside
 * the Tasks table or its `overflow-x-auto` wrapper) and pinned to the trigger's
 * logical end via `useAnchoredPopover` — so it floats above the table, flips
 * above when space is short, clamps to the viewport, and never grows the table
 * scroll area. Single-open coordination and stale-state closing on
 * filter/pagination are owned by `TaskTable` through the `open` / `onRequest*`
 * props (keyed by `{ id, variant }`).
 */
export function TaskDeleteConfirm({ task, open, onRequestOpen, onRequestClose }: TaskDeleteConfirmProps) {
  const { t } = useTranslation();
  const rootId = useId();
  const panelId = `${rootId}-panel`;
  const titleId = `${rootId}-title`;

  const remove = useDeleteTask();
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  // The task targeted when the popover opened — Confirm always acts on this id,
  // regardless of any row reshuffle from filtering/pagination behind the portal.
  const targetRef = useRef(task);

  const { triggerRef, panelRef, position, style } = useAnchoredPopover<HTMLButtonElement, HTMLDivElement>({
    open,
    align: "end",
    onDismiss: () => {
      if (!remove.isPending) onRequestClose();
    },
  });

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      targetRef.current = task;
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
  }, [open, task, triggerRef]);

  const requestClose = () => {
    if (!remove.isPending) onRequestClose();
  };

  const onConfirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync(targetRef.current.id);
      onRequestClose();
    } catch (mutationError) {
      setError(getLocalizedTaskError(mutationError, t("tasks.deleteError"), t));
    }
  };

  // Minimal focus trap: Cancel <-> Confirm are the only stops.
  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = [cancelRef.current, confirmRef.current].filter(
      (el): el is HTMLButtonElement => Boolean(el) && !el!.disabled,
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

  const panel =
    open && position
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            data-task-delete-confirm=""
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed z-50 flex flex-col overflow-hidden rounded-md border border-border bg-popover text-start text-popover-foreground shadow-flyout"
            style={style}
            onKeyDown={onPanelKeyDown}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <p id={titleId} className="text-sm font-medium leading-5 text-foreground" dir="auto">
                {t("tasks.deleteConfirmLabel", { title: task.title })}
              </p>
              {error && (
                <p role="alert" className="mt-2 text-xs leading-5 text-danger-foreground">
                  {error}
                </p>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-surface-secondary p-2.5">
              <button
                ref={cancelRef}
                type="button"
                className="button-ghost min-h-9 w-auto px-3 py-1 text-xs"
                disabled={remove.isPending}
                onClick={requestClose}
              >
                {t("common.cancel")}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="button-danger min-h-9 w-auto gap-1.5 px-3 py-1 text-xs"
                disabled={remove.isPending}
                onClick={onConfirm}
              >
                {remove.isPending ? (
                  <>
                    <SpinnerIcon className="size-3.5" />
                    {t("tasks.deleting")}
                  </>
                ) : error ? (
                  t("common.retry")
                ) : (
                  t("tasks.confirmDelete")
                )}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={TRIGGER}
        aria-label={t("tasks.deleteAction")}
        title={t("tasks.deleteAction")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? requestClose() : onRequestOpen())}
      >
        <TrashIcon />
      </button>
      {panel}
    </>
  );
}
