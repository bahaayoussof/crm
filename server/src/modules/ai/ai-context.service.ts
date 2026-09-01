import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { ticketVisibilityWhere, type TicketActor } from "../tickets/ticket-visibility.js";
import { resolveActorTeamScope } from "../../shared/team/team-scope.js";
import { replyHtmlToPlainText } from "../../shared/rich-text/reply-html.js";
import type { AiTicketContext } from "./ai.types.js";

/** Hard ceilings so a huge ticket never blows the provider context window. */
export const MAX_MESSAGES = 50;
export const MAX_CONVERSATION_CHARS = 25_000;
/** Tighter public-message cap for actions that only need the recent exchange. */
export const RECENT_PUBLIC_MESSAGES = 12;
/** Per-body clip so one enormous message cannot dominate the budget. */
const MAX_BODY_CHARS = 4_000;

export interface AiContextOptions {
  /**
   * `"full"` (default) includes internal notes; `"none"` omits them entirely —
   * used by CLASSIFY and KB_SUGGESTIONS, which must never see internal notes.
   */
  internalNotes?: "full" | "none";
  /** Cap on the most-recent public messages. Defaults to `MAX_MESSAGES`. */
  publicMessageLimit?: number;
}

const contextSelect = {
  id: true,
  subject: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  // Display name only — never email or phone (data minimization).
  customer: { select: { name: true } },
  messages: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { body: true, createdAt: true, author: { select: { role: true } } },
  },
  notes: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { body: true, createdAt: true },
  },
} satisfies Prisma.TicketSelect;

function clip(text: string): string {
  const value = text ?? "";
  return value.length > MAX_BODY_CHARS ? `${value.slice(0, MAX_BODY_CHARS)}…` : value;
}

/**
 * Load the authorized, minimized AI context for a ticket.
 *
 * Reuses the exact same visibility predicate as internal Ticket Details — there
 * is no weaker AI-only rule. A ticket the caller cannot see is a 404, identical
 * to `GET /api/tickets/:id`.
 */
export async function buildTicketAiContext(
  ticketId: string,
  actor: TicketActor,
  options?: AiContextOptions,
): Promise<AiTicketContext> {
  const includeNotes = (options?.internalNotes ?? "full") === "full";
  const messageLimit = Math.min(options?.publicMessageLimit ?? MAX_MESSAGES, MAX_MESSAGES);

  // Same visibility predicate as GET /api/tickets/:id, INCLUDING team scope — a
  // MANAGER cannot run AI actions against another team's ticket by id.
  const team = await resolveActorTeamScope(actor);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor, team) },
    select: contextSelect,
  });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

  const publicMessages = ticket.messages.map((m) => {
    const fromCustomer = m.author?.role === Role.CUSTOMER;
    return {
      authorType: (fromCustomer ? "CUSTOMER" : "AGENT") as "CUSTOMER" | "AGENT",
      // Staff replies are stored as sanitized HTML — flatten to text so the prompt
      // never carries markup. Customer inbound messages are already plain text.
      body: clip(fromCustomer ? m.body : replyHtmlToPlainText(m.body)),
      createdAt: m.createdAt.toISOString(),
    };
  });
  // Internal notes are dropped here (not just left unrendered) for actions that
  // request `internalNotes: "none"`, so they never reach the prompt builder.
  const internalNotes = includeNotes
    ? ticket.notes.map((n) => ({
        // Notes are stored as sanitized HTML from the shared rich editor — flatten
        // to text (mention tokens included) so the prompt gets clean prose.
        body: clip(replyHtmlToPlainText(n.body)),
        createdAt: n.createdAt.toISOString(),
      }))
    : [];

  // Keep the most recent messages within both budgets. The ticket description is
  // always kept (it is rendered separately from the conversation).
  let truncated = false;
  let messages = publicMessages;
  if (messages.length > messageLimit) {
    messages = messages.slice(-messageLimit);
    truncated = true;
  }
  let notes = internalNotes;

  const totalChars = () =>
    [...messages, ...notes].reduce((sum, item) => sum + item.body.length, 0);
  while (totalChars() > MAX_CONVERSATION_CHARS && (messages.length > 1 || notes.length > 0)) {
    // Drop oldest notes first, then oldest messages, keeping the latest exchange.
    if (notes.length > 0) notes = notes.slice(1);
    else messages = messages.slice(1);
    truncated = true;
  }

  return {
    ticket: {
      reference: ticket.id,
      subject: ticket.subject,
      description: clip(ticket.description),
      status: ticket.status,
      category: ticket.category ? { id: ticket.category.id, name: ticket.category.name } : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    },
    customerDisplayName: ticket.customer?.name ?? null,
    publicMessages: messages,
    internalNotes: notes,
    truncated,
  };
}
