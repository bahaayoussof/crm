import type { Prisma } from "@prisma/client";

/**
 * CONV-014 — shared correlated-ticket resolver (OD-CC-4).
 *
 * Accepts only explicit ticket/session evidence or verified provider
 * thread/message evidence as selection input — a customer id alone is never
 * sufficient. Channel-specific correlation rules (Email header/token/
 * reference logic, Live Chat session-key lookup, SMS/WhatsApp thread
 * evidence) stay in their own modules; those modules extract their evidence
 * first and then call this shared seam.
 *
 * Returns the ticket even if CLOSED — CLOSED-rejection is the caller's
 * responsibility (see CONV-018), since the correct behavior differs per
 * channel (discard-and-create-new vs 409).
 */
export type CorrelatedTicketResult<T> = { kind: "correlated"; ticket: T } | { kind: "none" };

export type CorrelationEvidence = { ticketId: string } | { sessionKey: string } | { providerThreadValue: string };

export async function resolveCorrelatedTicket<T>(
  tx: Prisma.TransactionClient,
  evidence: CorrelationEvidence,
  lookup: (tx: Prisma.TransactionClient, evidence: CorrelationEvidence) => Promise<T | null>,
): Promise<CorrelatedTicketResult<T>> {
  const ticket = await lookup(tx, evidence);
  if (!ticket) return { kind: "none" };
  return { kind: "correlated", ticket };
}
