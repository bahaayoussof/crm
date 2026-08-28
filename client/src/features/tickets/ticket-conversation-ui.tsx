import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatTicketDate } from "./ticket-format";

// Role-neutral presentational primitives for a ticket conversation. Both the
// internal Ticket Details view and the Customer Portal ticket view compose these
// so the two surfaces share one visual language. Nothing here decides what data
// a role may see — the caller maps its own view model onto these props.

// Progressive disclosure for genuinely long message bodies. Deterministic
// threshold (documented in docs/18): collapse only past ~10 lines or 800
// characters; the complete text always stays in the DOM.
const LONG_MESSAGE_LINES = 10;
const LONG_MESSAGE_CHARS = 800;

export function MessageBody({ body }: { body: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > LONG_MESSAGE_CHARS || body.split("\n").length > LONG_MESSAGE_LINES;
  return (
    <div className="mt-2">
      <p className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 ${isLong && !expanded ? "line-clamp-[10]" : ""}`}>
        {body}
      </p>
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

/** One conversation message: a width-bounded card aligned to the logical start or
 * end. `tone="internal"` gives the amber treatment reserved for internal notes. */
export function ConversationMessage({
  side,
  tone = "default",
  title,
  meta,
  badge,
  timestamp,
  language,
  body,
  footnote,
  attachmentsSlot,
}: {
  side: "start" | "end";
  tone?: "default" | "internal";
  title: string;
  meta?: string;
  badge?: string;
  timestamp: string;
  language: string;
  body: string;
  footnote?: string;
  attachmentsSlot?: React.ReactNode;
}) {
  const align = side === "start" ? "justify-start" : "justify-end";
  return (
    <li className={`flex ${align}`}>
      <article
        className={`min-w-0 max-w-full rounded-md border px-4 py-3 sm:max-w-[min(85%,46rem)] ${tone === "internal" ? "border-warning-soft bg-warning-soft/40 text-foreground" : "border-border bg-surface text-foreground"}`}
      >
        <header className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
        <MessageBody body={body} />
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
  bounded = false,
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
  /** Desktop only: turn the section into a bounded flex column whose message region scrolls internally. */
  bounded?: boolean;
}) {
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
        className={`min-h-48 px-4 sm:px-5 ${
          bounded ? "py-4 overflow-y-auto lg:min-h-0 lg:flex-1" : "py-2"
        }`}
      >
        {isEmpty ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyDescription && <p className="mt-1 max-w-md text-sm text-muted-foreground">{emptyDescription}</p>}
          </div>
        ) : (
          <ol className={bounded ? "space-y-5" : "space-y-4 py-2"} aria-label={timelineLabel}>
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
