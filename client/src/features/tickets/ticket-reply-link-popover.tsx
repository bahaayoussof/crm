import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import {
  validateLinkUrl,
  type LinkPopoverData,
  type LinkSubmitPayload,
} from "./ticket-reply-link.utils";

interface TicketReplyLinkPopoverProps {
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  initialData: LinkPopoverData;
  onSubmit: (payload: LinkSubmitPayload) => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function TicketReplyLinkPopover({
  open,
  triggerRef,
  initialData,
  onSubmit,
  onRemove,
  onClose,
}: TicketReplyLinkPopoverProps) {
  const { t } = useTranslation();
  const rootId = useId();
  const urlInputId = `${rootId}-url`;
  const textInputId = `${rootId}-text`;
  const checkboxId = `${rootId}-newtab`;
  const errorId = `${rootId}-error`;

  const [url, setUrl] = useState(initialData.url);
  const [text, setText] = useState(initialData.text);
  const [openInNewTab, setOpenInNewTab] = useState(initialData.openInNewTab);
  const [errorKey, setErrorKey] = useState<"urlRequired" | "invalidUrl" | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Sync state when initialData changes or popover opens
  useEffect(() => {
    if (open) {
      setUrl(initialData.url);
      setText(initialData.text);
      setOpenInNewTab(initialData.openInNewTab);
      setErrorKey(null);
    }
  }, [open, initialData]);

  const { panelRef, position } = useAnchoredPopover<HTMLElement, HTMLDivElement>({
    open,
    triggerRef,
    onDismiss: () => onClose(),
    align: "start",
    width: 320,
    minWidth: 280,
    maxWidth: 340,
    gap: 4,
    margin: 8,
  });

  // Focus URL input on open
  useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }, 30);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  if (!open || !position) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLinkUrl(url);
    if (!validation.valid || !validation.normalizedUrl) {
      setErrorKey(validation.errorKey ?? "invalidUrl");
      urlInputRef.current?.focus();
      return;
    }
    setErrorKey(null);
    onSubmit({
      url: validation.normalizedUrl,
      text: text.trim(),
      openInNewTab,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${rootId}-title`}
      className="fixed z-50 rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-elevated transition-all"
      style={{
        left: `${position.left}px`,
        width: `${position.width}px`,
        ...(position.top !== undefined ? { top: `${position.top}px` } : { bottom: `${position.bottom}px` }),
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 id={`${rootId}-title`} className="text-xs font-semibold text-foreground">
          {initialData.isExisting
            ? t("tickets.conversation.editor.linkPopover.editTitle")
            : t("tickets.conversation.editor.linkPopover.title")}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {/* URL Input */}
        <div>
          <label htmlFor={urlInputId} className="block text-xs font-medium text-foreground">
            {t("tickets.conversation.editor.linkPopover.urlLabel")}
          </label>
          <input
            ref={urlInputRef}
            id={urlInputId}
            type="text"
            dir="ltr"
            className="input mt-1 min-h-8 w-full px-2.5 py-1 text-xs sm:text-sm"
            placeholder={t("tickets.conversation.editor.linkPopover.urlPlaceholder")}
            value={url}
            aria-invalid={errorKey !== null}
            aria-describedby={errorKey ? errorId : undefined}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errorKey) setErrorKey(null);
            }}
          />
          {errorKey && (
            <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-xs text-danger">
              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{t(`tickets.conversation.editor.linkPopover.${errorKey}`)}</span>
            </p>
          )}
        </div>

        {/* Text Input */}
        <div>
          <label htmlFor={textInputId} className="block text-xs font-medium text-foreground">
            {t("tickets.conversation.editor.linkPopover.textLabel")}
          </label>
          <input
            id={textInputId}
            type="text"
            className="input mt-1 min-h-8 w-full px-2.5 py-1 text-xs sm:text-sm"
            placeholder={t("tickets.conversation.editor.linkPopover.textPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Open in new tab checkbox */}
        <label htmlFor={checkboxId} className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-foreground">
          <input
            id={checkboxId}
            type="checkbox"
            className="size-4 rounded border-border text-primary accent-primary focus:ring-primary/30"
            checked={openInNewTab}
            onChange={(e) => setOpenInNewTab(e.target.checked)}
          />
          <span>{t("tickets.conversation.editor.linkPopover.openInNewTab")}</span>
        </label>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          {initialData.isExisting && onRemove ? (
            <button
              type="button"
              className="text-xs font-medium text-danger hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
              onClick={onRemove}
            >
              {t("tickets.conversation.editor.linkPopover.remove")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-secondary min-h-8 px-2.5 py-1 text-xs"
              onClick={onClose}
            >
              {t("tickets.conversation.editor.linkPopover.cancel")}
            </button>
            <button
              type="submit"
              className="button-primary min-h-8 px-3 py-1 text-xs"
            >
              {initialData.isExisting
                ? t("tickets.conversation.editor.linkPopover.save")
                : t("tickets.conversation.editor.linkPopover.insert")}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
