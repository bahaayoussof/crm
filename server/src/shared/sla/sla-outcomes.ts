/**
 * Cohort SLA outcome helpers.
 *
 * These answer "met vs. breached vs. pending" for a ticket over its stored
 * timestamps — the tally primitive Reports and the Agent dashboard both need.
 * Deliberately separate from `shared/sla/derive-sla.ts`, which returns one
 * "right now" state label for a single ticket (see cerebrum note).
 *
 * Extracted verbatim from `reports/reports.service.ts` — no behavior change.
 */

export type SlaOutcome = "MET" | "BREACHED" | "PENDING" | "NONE";

/** The minimal timestamp shape every outcome helper reads. */
export interface SlaOutcomeTicket {
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export function firstResponseOutcome(ticket: SlaOutcomeTicket, now: Date): SlaOutcome {
  if (!ticket.firstResponseDueAt) return "NONE";
  if (ticket.firstRespondedAt) {
    return ticket.firstRespondedAt.getTime() <= ticket.firstResponseDueAt.getTime() ? "MET" : "BREACHED";
  }
  return now.getTime() > ticket.firstResponseDueAt.getTime() ? "BREACHED" : "PENDING";
}

export function resolutionOutcome(ticket: SlaOutcomeTicket, now: Date): SlaOutcome {
  if (!ticket.resolutionDueAt) return "NONE";
  const completedAt = ticket.resolvedAt ?? ticket.closedAt;
  if (completedAt) {
    return completedAt.getTime() <= ticket.resolutionDueAt.getTime() ? "MET" : "BREACHED";
  }
  return now.getTime() > ticket.resolutionDueAt.getTime() ? "BREACHED" : "PENDING";
}

export function compliancePct(met: number, breached: number): number | null {
  const total = met + breached;
  return total === 0 ? null : Math.round((met / total) * 100);
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}
