import { useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { renderMentions } from "@/features/collaboration/render-mentions";
import { formatTicketDate } from "./ticket-format";
import { useConversationAutoScroll } from "./use-conversation-auto-scroll";

// Role-neutral presentational primitives for a ticket conversation. Both the
// internal Ticket Details view and the Customer Portal ticket view compose these
// so the two surfaces share one visual language. Nothing here decides what data
// a role may see — the caller maps its own view model onto these props.

// Progressive disclosure for genuinely long message bodies. Deterministic
// threshold (documented in docs/18): collapse only past ~10 lines or 800
// characters; the complete text always stays in the DOM.
const LONG_MESSAGE_LINES = 10;
const LONG_MESSAGE_CHARS = 800;

// Public staff replies are stored as server-sanitized HTML from the Lexical
// composer; everything else (customer messages, internal notes) is plain text.
// The render path is chosen by content, and the HTML is re-sanitized here so a
// pre-sanitizer row — or any unexpected markup — can never inject.
const RICH_ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "p", "br", "ul", "ol", "li", "a"];
const RICH_SAFE_URI = /^(?:https?:|mailto:)/i;
const LOOKS_LIKE_HTML = /<(?:\/?)(?:b|strong|i|em|u|p|br|ul|ol|li|a)\b[^>]*>/i;

if (typeof window !== "undefined" && typeof DOMPurify.addHook === "function") {
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.nodeName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });
}

function sanitizeReplyHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: RICH_SAFE_URI,
  });
}

// Mirrors the server `parseMentions` / client `renderMentions` token.
const MENTION_TOKEN_HTML = /@\[([^\]\r\n]{1,120})\]\(([A-Za-z0-9_-]{1,64})\)/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn `@[Name](userId)` tokens inside already-sanitized note HTML into inline
 * mention chips (`@Name`, id dropped). Runs AFTER DOMPurify and only injects a
 * `<span>` with static classes + an HTML-escaped name — safe by construction. */
function tokenizeMentionsHtml(safeHtml: string): string {
  return safeHtml.replace(
    MENTION_TOKEN_HTML,
    (_match, name: string) =>
      `<span data-mention class="rounded-sm bg-primary/10 px-1 font-medium text-primary">@${escapeHtml(
        name.trim(),
      )}</span>`,
  );
}

export function MessageBody({
  body,
  mentionize = false,
}: {
  body: string;
  /** Internal-note bodies: render `@[Name](id)` tokens as mention chips (works on
   * both the sanitized-HTML path and the legacy plain-text path). */
  mentionize?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > LONG_MESSAGE_CHARS || body.split("\n").length > LONG_MESSAGE_LINES;
  const clamp = isLong && !expanded ? "line-clamp-[10]" : "";
  const asHtml = LOOKS_LIKE_HTML.test(body);
  const html = asHtml
    ? mentionize
      ? tokenizeMentionsHtml(sanitizeReplyHtml(body))
      : sanitizeReplyHtml(body)
    : "";

  return (
    <div className="mt-2">
      {asHtml ? (
        <div
          className={`break-words [overflow-wrap:anywhere] text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:ms-5 [&_ol]:list-decimal [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ul]:ms-5 [&_ul]:list-disc ${clamp}`}
          // Re-sanitized on the client; server already sanitized on write.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 ${clamp}`}>
          {mentionize ? renderMentions(body) : body}
        </p>
      )}
      {isLong && (
        <button
          type="button"
          className="mt-1.5 rounded-sm text-xs font-medium text-foreground transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("tickets.conversation.showLess") : t("tickets.conversation.showMore")}
        </button>
      )}
    </div>
  );
}

/** First letter of the first two words of a name — a lightweight avatar stand-in
 * (no image source exists in the conversation contract). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** One conversation message — a width-bounded bubble aligned to the logical
 * start or end via `side`. The internal Ticket Details view aligns by sender role
 * (customer → start, staff + internal note → end); the Customer Portal aligns by
 * its own author kind. `maxWidthClass` tunes the bubble ceiling per surface.
 *
 * `tone="internal"` gives the amber treatment reserved for internal notes. */
export function ConversationMessage({
  side,
  tone = "default",
  title,
  meta,
  badge,
  timestamp,
  language,
  body,
  mentionize = false,
  footnote,
  attachmentsSlot,
  maxWidthClass = "sm:max-w-[min(85%,46rem)]",
}: {
  side: "start" | "end";
  tone?: "default" | "internal";
  title: string;
  meta?: string;
  badge?: string;
  timestamp: string;
  language: string;
  body: string;
  /** Internal-note bodies: render `@[Name](id)` tokens as chips. */
  mentionize?: boolean;
  footnote?: string;
  attachmentsSlot?: React.ReactNode;
  /** Tailwind max-width utility for the bubble (default: Portal's wide ceiling). */
  maxWidthClass?: string;
}) {
  const surface =
    tone === "internal"
      ? "border-warning-soft bg-warning-soft/40 text-foreground"
      : "border-border bg-surface text-foreground";

  const align = side === "start" ? "justify-start" : "justify-end";
  return (
    <li className={`flex ${align}`}>
      <article
        className={`min-w-0 max-w-full rounded-md border px-4 py-3 ${maxWidthClass} ${surface}`}
      >
        <header className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex size-6 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-semibold sm:self-center ${tone === "internal" ? "bg-warning-soft text-warning-foreground" : "bg-surface-secondary text-muted-foreground"}`}
              aria-hidden="true"
            >
              {initialsOf(title)}
            </span>
            <span className="min-w-0 break-words text-sm font-semibold" dir="auto">
              {title}
            </span>
            {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
            {badge && (
              <span className="rounded-sm border border-warning-soft bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">
                {badge}
              </span>
            )}
          </div>
          <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground" dir="ltr" dateTime={timestamp}>
            {formatTicketDate(timestamp, language)}
          </time>
        </header>
        <MessageBody body={body} mentionize={mentionize} />
        {attachmentsSlot}
        {footnote && <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>}
      </article>
    </li>
  );
}

/** The conversation card: bordered surface, header, a min-height scrollable body
 * holding the message list or an empty state, and an optional composer footer. */
export function ConversationSection({
  headingId = "ticket-conversation-heading",
  heading,
  description,
  timelineLabel,
  countLabel,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
  belowBody,
  footer,
  viewportOverride,
  bounded = false,
  autoScrollItemCount,
  autoScrollSendToken,
}: {
  headingId?: string;
  heading: string;
  description?: string;
  timelineLabel: string;
  countLabel?: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  children: React.ReactNode;
  /** Rendered between the scrollable message region and the footer (e.g. an attach-file band). */
  belowBody?: React.ReactNode;
  footer?: React.ReactNode;
  /** When set, temporarily replaces the message list inside the SAME bounded
   * viewport (e.g. the attachment-upload workspace) so the card geometry and the
   * conversation query stay untouched. */
  viewportOverride?: React.ReactNode;
  /** Desktop only: turn the section into a bounded flex column whose message region scrolls internally. */
  bounded?: boolean;
  /** Message count — drives initial "scroll to latest" and near-bottom follow. */
  autoScrollItemCount?: number;
  /** Bump on every successful send by the local user to force a scroll to latest. */
  autoScrollSendToken?: number;
}) {
  const scrollRef = useConversationAutoScroll<HTMLDivElement>({
    itemCount: autoScrollItemCount ?? 0,
    sendToken: autoScrollSendToken,
  });
  return (
    <section
      className={`overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle ${
        bounded ? "lg:flex lg:h-full lg:flex-col" : ""
      }`}
      aria-labelledby={headingId}
    >
      <div className="border-b border-border px-5 py-4 lg:shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold" id={headingId}>
            {heading}
          </h2>
          {countLabel && <span className="shrink-0 text-xs text-muted-foreground">{countLabel}</span>}
        </div>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div
        ref={scrollRef}
        data-conversation-scroll
        className={`min-h-48 px-4 sm:px-5 ${
          bounded ? "py-4 overflow-y-auto lg:min-h-0 lg:flex-1" : "py-2"
        }`}
      >
        {viewportOverride ? (
          viewportOverride
        ) : isEmpty ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyDescription && <p className="mt-1 max-w-md text-sm text-muted-foreground">{emptyDescription}</p>}
          </div>
        ) : (
          <ol className={bounded ? "space-y-4" : "space-y-4 py-2"} aria-label={timelineLabel}>
            {children}
          </ol>
        )}
      </div>
      {belowBody && <div className="border-t border-border lg:shrink-0">{belowBody}</div>}
      {footer && (
        <div className="border-t border-border bg-surface-secondary p-4 sm:p-5 lg:shrink-0">{footer}</div>
      )}
    </section>
  );
}
