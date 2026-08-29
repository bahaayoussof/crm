import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ticketReference } from "./ticket-format";

/**
 * Shared Ticket Details presentation primitives, composed by both the internal
 * agent workspace and the Customer Portal ticket view. Neither of these decides
 * what a role may see — the caller passes its own already-authorized content into
 * the slots. Role differences are composition (which slots are filled), never
 * boolean flags inside these components.
 */

/**
 * Compact ticket header: back link, subject `<h1>`, a glanceable chip row after
 * the reference id, an optional right-aligned action slot, and optional metadata
 * below the chip row. No card surface — a single bottom divider keeps it light.
 */
export function TicketDetailHeader({
  backTo,
  backLabel,
  reference,
  subject,
  badges,
  actions,
  children,
}: {
  backTo: string;
  backLabel: string;
  reference: string;
  subject: string;
  /** Chips rendered inline after the reference id (status badge, etc.). */
  badges?: ReactNode;
  /** Right-aligned actions (e.g. Edit). Omit for read-only roles. */
  actions?: ReactNode;
  /** Optional metadata block rendered full-width below the chip row. */
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-border pb-4">
      <Link
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        to={backTo}
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" strokeWidth={1.75} aria-hidden="true" />
        <span>{backLabel}</span>
      </Link>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-2xl">
            {subject}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-xs font-medium text-primary" dir="ltr">
              {ticketReference(reference)}
            </span>
            {badges}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/**
 * A headed card surface for a Ticket Details section — the same border/radius/
 * background/padding treatment as `ConversationSection` and `TicketAttachments`.
 * Pass `heading` for a titled section; omit it to use the shell as a plain
 * bordered card around content that provides its own heading.
 */
export function TicketDetailSection({
  heading,
  headingId,
  headerSlot,
  children,
  className = "",
  bodyClassName = "",
}: {
  heading?: string;
  headingId?: string;
  /** Optional right-aligned content in the header row (e.g. a count). */
  headerSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-md border border-border bg-card text-card-foreground shadow-subtle ${className}`}
      aria-labelledby={heading ? headingId : undefined}
    >
      {heading && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold" id={headingId}>
            {heading}
          </h2>
          {headerSlot}
        </div>
      )}
      <div className={`px-4 py-4 sm:px-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * Loading placeholder for a ticket detail page. `variant="workspace"` matches the
 * internal two-column agent layout; `variant="portal"` matches the single-column
 * customer view. Both open with the same header-shaped block so the skeleton
 * tracks the real `TicketDetailHeader`.
 */
export function TicketDetailSkeleton({
  label,
  variant = "workspace",
}: {
  label: string;
  variant?: "workspace" | "portal";
}) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="space-y-3 border-b border-border pb-4">
        <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </div>
      {variant === "workspace" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-96 animate-pulse rounded-xl bg-muted/40" />
        </div>
      ) : (
        <>
          <div className="h-28 animate-pulse rounded-md bg-muted/50" />
          <div className="h-64 animate-pulse rounded-md bg-muted/50" />
        </>
      )}
    </div>
  );
}
