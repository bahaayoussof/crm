import { TicketStatus } from "@prisma/client";

export const SLA_WARNING_MINUTES = 60;

export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED";
export type SlaTarget = "FIRST_RESPONSE" | "RESOLUTION" | null;

export interface DerivedSla {
  slaState: SlaState;
  effectiveSlaDueAt: string | null;
  effectiveSlaTarget: SlaTarget;
}

export interface SlaTicketSnapshot {
  status: TicketStatus;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

export function deriveSla(ticket: SlaTicketSnapshot, now: Date): DerivedSla {
  if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED || ticket.resolvedAt || ticket.closedAt) {
    return emptyResult("MET");
  }

  const candidates: Array<{ dueAt: Date; target: Exclude<SlaTarget, null> }> = [];
  if (ticket.firstRespondedAt === null && ticket.firstResponseDueAt) {
    candidates.push({ dueAt: ticket.firstResponseDueAt, target: "FIRST_RESPONSE" });
  }
  if (ticket.resolutionDueAt) candidates.push({ dueAt: ticket.resolutionDueAt, target: "RESOLUTION" });

  candidates.sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime() || targetRank(left.target) - targetRank(right.target));
  const effective = candidates[0];
  if (!effective) {
    return emptyResult(ticket.firstResponseDueAt && ticket.firstRespondedAt ? "MET" : "NOT_CONFIGURED");
  }

  const remainingMs = effective.dueAt.getTime() - now.getTime();
  const slaState: SlaState = remainingMs <= 0
    ? "BREACHED"
    : remainingMs <= SLA_WARNING_MINUTES * 60_000
      ? "AT_RISK"
      : "ON_TRACK";

  return { slaState, effectiveSlaDueAt: effective.dueAt.toISOString(), effectiveSlaTarget: effective.target };
}

function emptyResult(slaState: Extract<SlaState, "MET" | "NOT_CONFIGURED">): DerivedSla {
  return { slaState, effectiveSlaDueAt: null, effectiveSlaTarget: null };
}

function targetRank(target: Exclude<SlaTarget, null>) {
  return target === "FIRST_RESPONSE" ? 0 : 1;
}
