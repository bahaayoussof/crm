import { Prisma, TicketStatus } from "@prisma/client";
import { SLA_WARNING_MINUTES } from "./derive-sla.js";

/**
 * Query-time SLA-state filter, shared by the ticket list (`listTickets`) and the
 * Manager overview so a "SLA breached / at risk" count and the queue it links to
 * always agree.
 *
 * `breached`  — an unresolved ticket whose first-response or resolution target is
 *               already past due.
 * `at_risk`   — an unresolved ticket whose nearest target falls inside the
 *               `SLA_WARNING_MINUTES` window but is not yet past due.
 *
 * Mirrors the logic in `derive-sla.ts` (which labels a single ticket) but as a
 * Prisma `where` fragment. Meant to be ANDed with the caller's other predicates.
 */
export type SlaFilter = "breached" | "at_risk";

const UNRESOLVED: Prisma.TicketWhereInput = {
  status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
  resolvedAt: null,
  closedAt: null,
};

function dueByOr(end: Date): Prisma.TicketWhereInput[] {
  return [
    { firstRespondedAt: null, firstResponseDueAt: { lte: end } },
    { resolutionDueAt: { lte: end } },
  ];
}

export function slaFilterWhere(filter: SlaFilter, now: Date): Prisma.TicketWhereInput {
  if (filter === "breached") {
    return { ...UNRESOLVED, OR: dueByOr(now) };
  }
  const warningEnd = new Date(now.getTime() + SLA_WARNING_MINUTES * 60_000);
  return {
    ...UNRESOLVED,
    OR: dueByOr(warningEnd),
    NOT: { OR: dueByOr(now) },
  };
}
