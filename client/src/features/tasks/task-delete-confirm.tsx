import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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
  hideTrigger?: boolean;
  externalTriggerRef?: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Centered modal confirmation dialog for Task deletion.
 *
 * Renders portalled onto `document.body` with a full-viewport backdrop overlay,
 * centered horizontally and vertically in the browser viewport.
 */
export function TaskDeleteConfirm({
  task,
  open,
  onRequestOpen,
  onRequestClose,
  hideTrigger = false,
  externalTriggerRef,
}: TaskDeleteConfirmProps) {
  const { t } = useTranslation();
  const rootId = useId();
  const panelId = `${rootId}-panel`;
  const titleId = `${rootId}-title`;

  const remove = useDeleteTask();
  const [error, setError] = useState<string | null>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const contentRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const targetRef = useRef(task);

  const requestClose = useCallback(() => {
    if (!remove.isPending) onRequestClose();
  }, [onRequestClose, remove.isPending]);

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
      await remove.mutateAsync(targetRef.current.id);
      onRequestClose();
    } catch (mutationError) {
      setError(getLocalizedTaskError(mutationError, t("tasks.deleteError"), t));
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

  const panel = open
    ? createPortal(
        <div
          id={panelId}
          data-task-delete-confirm=""
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in-0 duration-150"
          onKeyDown={onPanelKeyDown}
        >
          <div
            ref={contentRef}
            className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-flyout animate-in zoom-in-95 fade-in-0 duration-150"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-5 text-start">
              <h3 id={titleId} className="text-base font-semibold leading-6 text-foreground" dir="auto">
                {t("tasks.deleteConfirmLabel", { title: task.title })}
              </h3>
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
                disabled={remove.isPending}
                onClick={requestClose}
              >
                {t("common.cancel")}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="button-danger min-h-9 gap-1.5 px-4 py-2 text-xs font-medium"
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
          </div>
        </div>,
        document.body,
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
        className={TRIGGER}
        aria-label={t("tasks.deleteAction")}
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
