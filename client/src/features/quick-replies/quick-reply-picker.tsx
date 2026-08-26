import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useQuickReplies } from "./quick-reply-hooks";
import { QuickReplyIcon } from "./quick-reply-icons";

/**
 * Compact composer action: a collapsed "Insert quick reply" trigger that opens a
 * searchable, keyboard-accessible popover. The popover content is rendered through
 * a portal on `document.body` and positioned with `position: fixed` against the
 * trigger rect, so it escapes the Ticket Conversation card's `overflow-hidden`
 * clipping and flips above the trigger when there is not enough room below.
 *
 * Selecting a result calls `onSelect(body)`; it never submits the reply. Mount /
 * visibility (Reply tab only, mutating agent, never Portal) is the caller's job.
 */
type PanelPosition = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const MIN_WIDTH = 288;
const MAX_HEIGHT = 320;
const MIN_HEIGHT = 120;
const GAP = 4;
const MARGIN = 8;

export function QuickReplyPicker({ onSelect, disabled }: { onSelect: (body: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const rootId = useId();
  const popoverId = `${rootId}-popover`;
  const listboxId = `${rootId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<PanelPosition | null>(null);

  const debouncedQuery = useDebouncedValue(query);
  const quickReplies = useQuickReplies({ search: debouncedQuery.trim(), page: 1, limit: 10 }, { enabled: open });
  const results = quickReplies.data?.data ?? [];

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewportWidth - MARGIN * 2);
    const rtl = document.documentElement.getAttribute("dir") === "rtl";
    let left = rtl ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, viewportWidth - width - MARGIN));
    const spaceBelow = viewportHeight - rect.bottom - GAP - MARGIN;
    const spaceAbove = rect.top - GAP - MARGIN;
    if (spaceBelow >= Math.min(MAX_HEIGHT, 160) || spaceBelow >= spaceAbove) {
      setPosition({ left, width, top: rect.bottom + GAP, maxHeight: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, spaceBelow)) });
    } else {
      setPosition({ left, width, bottom: viewportHeight - rect.top + GAP, maxHeight: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, spaceAbove)) });
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    updatePosition();
    const reflow = () => updatePosition();
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open, updatePosition]);

  useEffect(() => { if (open) searchRef.current?.focus(); }, [open]);
  useEffect(() => { setActiveIndex(-1); }, [debouncedQuery]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
      setActiveIndex(-1);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (returnFocus) triggerRef.current?.focus();
  };

  const choose = (body: string) => {
    onSelect(body); // parent returns focus + caret to the reply textarea
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  const panel = open && position
    ? createPortal(
        <div
          ref={panelRef}
          id={popoverId}
          data-quick-reply-popover=""
          className="fixed z-50 flex flex-col overflow-hidden rounded-md border bg-white shadow-lg"
          style={{ left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: position.maxHeight }}
        >
          <div className="border-b p-2">
            <input
              ref={searchRef}
              className="input h-9 py-1 text-sm"
              type="text"
              role="combobox"
              autoComplete="off"
              aria-label={t("quickReplies.picker.label")}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded
              aria-activedescendant={results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined}
              placeholder={t("quickReplies.picker.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.preventDefault(); close(); return; }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (!results.length) return;
                  const direction = event.key === "ArrowDown" ? 1 : -1;
                  setActiveIndex((current) => current === -1
                    ? (direction === 1 ? 0 : results.length - 1)
                    : (current + direction + results.length) % results.length);
                  return;
                }
                if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex].body); }
              }}
            />
          </div>
          <div id={listboxId} role="listbox" aria-label={t("quickReplies.picker.results")} className="min-h-0 flex-1 overflow-y-auto p-1">
            {quickReplies.isLoading ? (
              <p className="px-3 py-3 text-sm text-muted-foreground" role="status">{t("quickReplies.picker.searching")}</p>
            ) : quickReplies.isError ? (
              <p className="px-3 py-3 text-sm text-red-700" role="status">{t("quickReplies.picker.error")}</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground" role="status">
                {debouncedQuery.trim() ? t("quickReplies.picker.noResults") : t("quickReplies.picker.empty")}
              </p>
            ) : results.map((item, index) => (
              <button
                id={`${listboxId}-${item.id}`}
                key={item.id}
                className={`block w-full rounded px-3 py-2 text-start outline-none hover:bg-muted focus-visible:bg-muted ${index === activeIndex ? "bg-muted" : ""}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(item.body)}
              >
                <span className="block truncate text-sm font-medium text-foreground" dir="auto">{item.title}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="auto">{item.body}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="w-full sm:w-auto">
      <button
        ref={triggerRef}
        type="button"
        className="button-secondary w-full gap-2 sm:w-auto"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <QuickReplyIcon className="size-4 shrink-0" />
        {t("quickReplies.picker.trigger")}
      </button>
      {panel}
    </div>
  );
}
