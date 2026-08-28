import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAnchoredPopover } from "@/components/shared/use-anchored-popover";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { cn } from "@/lib/utils";
import { useMentionableUsers } from "./collaboration-hooks";
import type { MentionableUser } from "./collaboration.types";

// Matches an in-progress `@query` immediately before the caret. The query stops
// at whitespace / a second `@`, so only the token being typed is considered.
const ACTIVE_MENTION = /(?:^|\s)@([^\s@]{0,40})$/;

interface MentionTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaDescribedBy?: string;
}

/**
 * The internal-note composer textarea with `@mention` autocomplete. Typing `@`
 * opens an anchored, portalled popover of active internal users (reused
 * `use-anchored-popover` so it escapes the conversation card's `overflow-hidden`).
 * Selecting a user inserts `@[Name](userId) `. Applies to the Internal Note tab
 * only — the public reply composer is unchanged.
 */
export function MentionTextarea({
  id,
  value,
  onChange,
  disabled,
  className,
  ariaDescribedBy,
}: MentionTextareaProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const caretAfterInsert = useRef<number | null>(null);

  const debouncedQuery = useDebouncedValue(query);
  const mentionable = useMentionableUsers(debouncedQuery.trim(), { enabled: open });
  const results = mentionable.data ?? [];

  const { triggerRef, panelRef, style } = useAnchoredPopover<HTMLDivElement, HTMLDivElement>({
    open,
    onDismiss: () => close(),
    align: "start",
    width: 340,
    minWidth: 260,
    maxWidth: 420,
    maxHeight: 288,
    minHeight: 96,
  });

  function close() {
    setOpen(false);
    setQuery("");
    setMentionStart(null);
    setActiveIndex(0);
  }

  useEffect(() => setActiveIndex(0), [debouncedQuery]);

  // Restore the caret after a controlled-value insert.
  useLayoutEffect(() => {
    const caret = caretAfterInsert.current;
    if (caret === null) return;
    caretAfterInsert.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [value]);

  function syncMentionState(nextValue: string, caret: number) {
    const match = ACTIVE_MENTION.exec(nextValue.slice(0, caret));
    if (!match || disabled) {
      if (open) close();
      return;
    }
    setQuery(match[1] ?? "");
    setMentionStart(caret - (match[1]?.length ?? 0) - 1);
    setActiveIndex(0);
    setOpen(true);
  }

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    onChange(next);
    syncMentionState(next, event.target.selectionStart ?? next.length);
  }

  function insertMention(user: MentionableUser) {
    const el = textareaRef.current;
    const liveCaret = el?.selectionStart ?? value.length;
    const start = mentionStart ?? liveCaret;
    // Replace exactly the "@query" span (deterministic — does not depend on the
    // textarea keeping its live selection through the controlled re-render).
    const end = Math.max(liveCaret, start + 1 + query.length);
    const token = `@[${user.name}](${user.id}) `;
    const next = value.slice(0, start) + token + value.slice(end);
    caretAfterInsert.current = start + token.length;
    onChange(next);
    close();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || results.length === 0) {
      if (open && event.key === "Escape") {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) insertMention(chosen);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  return (
    <div ref={triggerRef} className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        className={className}
        value={value}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-autocomplete="list"
        aria-describedby={ariaDescribedBy}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Let a click on a result land first.
          window.setTimeout(() => close(), 120);
        }}
      />

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            data-mention-popover
            className="fixed z-[60] flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-flyout"
          >
            <div
              id={listboxId}
              role="listbox"
              aria-label={t("collaboration.mention.listLabel")}
              className="min-h-0 flex-1 overflow-y-auto p-1"
            >
              {mentionable.isLoading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                  {t("collaboration.mention.loading")}
                </p>
              ) : mentionable.isError ? (
                <p className="px-3 py-2 text-sm text-danger-foreground" role="status">
                  {t("collaboration.mention.error")}
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground" role="status">
                  {t("collaboration.mention.noResults")}
                </p>
              ) : (
                results.map((user, index) => (
                  <button
                    key={user.id}
                    id={`${listboxId}-${user.id}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    className={cn(
                      "block w-full rounded-sm px-3 py-2 text-start outline-none transition-colors hover:bg-surface-hover",
                      index === activeIndex && "bg-surface-hover",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => insertMention(user)}
                  >
                    <span className="block truncate text-sm font-medium text-foreground" dir="auto">
                      {user.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="ltr">
                      {user.email}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
