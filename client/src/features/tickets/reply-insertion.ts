/**
 * Canonical public-reply insertion logic, shared by the Quick Reply picker and
 * the AI Suggested Reply "Insert into Reply" action. There is exactly one splice
 * implementation — do not add a second one.
 */

export const MAX_PUBLIC_REPLY_LENGTH = 20_000;

export type SpliceOutcome =
  | { status: "inserted"; nextValue: string; caret: number }
  | { status: "too-long" };

/**
 * Caret-aware splice: place `snippet` into `current` over the selection
 * `[start, end)`, adding a blank line before/after only when the neighbouring
 * text needs separating. Returns the next value and the caret position that
 * should sit just after the inserted snippet, or `too-long` when the result
 * would exceed {@link MAX_PUBLIC_REPLY_LENGTH} (caller must leave the draft
 * untouched in that case).
 */
export function spliceReply(current: string, snippet: string, start: number, end: number): SpliceOutcome {
  const before = current.slice(0, start);
  const after = current.slice(end);
  const leading = before !== "" && !/\s$/.test(before) ? "\n\n" : "";
  const trailing = after !== "" && !/^\s/.test(after) ? "\n\n" : "";
  const inserted = `${leading}${snippet}${trailing}`;
  const nextValue = `${before}${inserted}${after}`;
  if (nextValue.length > MAX_PUBLIC_REPLY_LENGTH) return { status: "too-long" };
  return { status: "inserted", nextValue, caret: before.length + leading.length + snippet.length };
}

/** Wholesale replace the draft with `text`, subject to the same length limit. */
export function replaceReplyValue(text: string): SpliceOutcome {
  if (text.length > MAX_PUBLIC_REPLY_LENGTH) return { status: "too-long" };
  return { status: "inserted", nextValue: text, caret: text.length };
}
