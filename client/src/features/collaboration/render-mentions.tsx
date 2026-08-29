import { Fragment, type ReactNode } from "react";

// Mirrors the server `parseMentions` token. Bounded quantifiers → linear time.
const MENTION_TOKEN = /@\[([^\]\r\n]{1,120})\]\(([A-Za-z0-9_-]{1,64})\)/g;

/**
 * Render an internal-note body, turning stored `@[Name](userId)` tokens into
 * inline mention chips that show only `@Name`. The user id is never rendered, and
 * the stored display name is used verbatim so historical notes stay readable even
 * if the user is later renamed, deactivated, or removed. Not a link.
 */
export function renderMentions(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  MENTION_TOKEN.lastIndex = 0;
  while ((match = MENTION_TOKEN.exec(text)) !== null) {
    const name = (match[1] ?? "").trim();
    if (!name) continue;
    if (match.index > cursor) {
      nodes.push(<Fragment key={key++}>{text.slice(cursor, match.index)}</Fragment>);
    }
    nodes.push(
      <span
        key={key++}
        data-mention
        className="rounded-sm bg-primary/10 px-1 font-medium text-primary"
      >
        @{name}
      </span>,
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  return nodes.length > 0 ? nodes : text;
}
