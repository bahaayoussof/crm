import { TicketStatus } from "@prisma/client";

/**
 * Canonical automatic-assignment vocabulary (feature/automatic-assignment).
 *
 * V1 policy — deliberately narrow:
 *
 *   Team-owned unassigned non-terminal ticket
 *     -> least active-workload eligible active AGENT on that same Team
 *
 * Automatic assignment NEVER infers or invents a Team: a ticket with
 * `teamId = null` is left unassigned for ADMIN routing. It only ever FILLS an
 * empty `assignedAgentId` — it is not a continuous load balancer and never
 * reassigns an already-assigned ticket.
 */

/**
 * Non-terminal operational statuses that count toward an agent's "active
 * workload" and gate whether a ticket is still eligible for assignment. Mirrors
 * the SLA monitor's active-status set (`docs/08-sla-automation.md`); shared here
 * so there is a single source of truth.
 */
export const ASSIGNMENT_ACTIVE_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;

/** Terminal statuses — never assigned, never counted as workload. */
export const ASSIGNMENT_TERMINAL_STATUSES = [TicketStatus.RESOLVED, TicketStatus.CLOSED] as const;

export function isTerminalTicketStatus(status: TicketStatus): boolean {
  return status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED;
}

/**
 * Shared identifiers so an automatic assignment reads identically whether it came
 * from this synchronous engine or the bounded SLA-monitor cron.
 */
export const AUTO_ASSIGNMENT_HISTORY_ACTION = "AUTO_ASSIGNMENT";
export const AUTO_ASSIGNMENT_AUDIT_REASON = "automatic_assignment";
export const AUTO_ASSIGNMENT_NOTIFICATION_TYPE = "TICKET_AUTO_ASSIGNED";

/** One eligible agent plus the workload figure the selection ranked on. */
export interface TeamAgentCandidate {
  id: string;
  name: string;
  activeWorkload: number;
}

/** Everything the engine needs to decide whether (and to whom) to auto-assign. */
export interface AutoAssignInput {
  ticketId: string;
  /** The ticket's CURRENT authoritative owning team. `null` => leave unassigned. */
  teamId: string | null;
  /** The ticket's CURRENT assignee. Non-null => hard no-op (existing assignment wins). */
  assignedAgentId: string | null;
  /** The ticket's CURRENT status. Terminal => no-op. */
  status: TicketStatus;
}

export interface AutoAssignOutcome {
  assignedAgentId: string;
  agentName: string;
}
