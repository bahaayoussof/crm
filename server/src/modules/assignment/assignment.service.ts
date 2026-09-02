import { Prisma, Role } from "@prisma/client";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { createNotifications } from "../notifications/notification.service.js";
import {
  ASSIGNMENT_ACTIVE_STATUSES,
  AUTO_ASSIGNMENT_AUDIT_REASON,
  AUTO_ASSIGNMENT_HISTORY_ACTION,
  AUTO_ASSIGNMENT_NOTIFICATION_TYPE,
  isTerminalTicketStatus,
  type AutoAssignInput,
  type AutoAssignOutcome,
  type TeamAgentCandidate,
} from "./assignment.types.js";

/**
 * The single source of truth for automatic ticket assignment policy
 * (feature/automatic-assignment). Callers hand this module a ticket that already
 * knows its Team; it picks the correct Agent. It never decides which Department
 * or Team should own a ticket.
 *
 * Every operation runs against a caller-supplied `Prisma.TransactionClient`, so
 * auto-assignment shares the ticket create/update transaction and its
 * `withRealtimeOutbox` boundary — the assignment either commits with the ticket
 * or not at all, and the realtime `ticket.updated` event is emitted by the
 * caller after commit.
 *
 * Reused, not duplicated:
 *   - active-status set / terminal check  -> assignment.types.ts
 *   - team-scoped agent eligibility       -> `role === AGENT && isActive && teamId === ticket.teamId`
 *     (the same invariant `assertAgentAssignableToTicket` enforces for manual
 *      assignment: same team only, never cross-team)
 *   - history / audit / notification / realtime -> the canonical ticket pipelines
 */

/**
 * Active (non-terminal) ticket counts for a set of agents, keyed by agent id.
 * Agents with no active tickets are present with `0`.
 */
export async function getAgentActiveWorkload(
  db: Prisma.TransactionClient,
  agentIds: string[],
): Promise<Map<string, number>> {
  const workload = new Map<string, number>(agentIds.map((id) => [id, 0]));
  if (agentIds.length === 0) return workload;
  const grouped = await db.ticket.groupBy({
    by: ["assignedAgentId"],
    where: { assignedAgentId: { in: agentIds }, status: { in: [...ASSIGNMENT_ACTIVE_STATUSES] } },
    _count: { _all: true },
  });
  for (const row of grouped) {
    if (row.assignedAgentId) workload.set(row.assignedAgentId, row._count._all);
  }
  return workload;
}

/**
 * Every agent eligible to receive a ticket owned by `teamId`, ranked by the V1
 * strategy: lowest active workload first, then a stable `id` tie-break so the
 * result is fully deterministic (no `Math.random`, no unstable DB ordering).
 */
export async function getEligibleTeamAgents(
  db: Prisma.TransactionClient,
  teamId: string,
): Promise<TeamAgentCandidate[]> {
  const agents = await db.user.findMany({
    where: { role: Role.AGENT, isActive: true, teamId },
    select: { id: true, name: true },
  });
  if (agents.length === 0) return [];
  const workload = await getAgentActiveWorkload(db, agents.map((agent) => agent.id));
  return agents
    .map((agent) => ({ id: agent.id, name: agent.name, activeWorkload: workload.get(agent.id) ?? 0 }))
    .sort((left, right) => left.activeWorkload - right.activeWorkload || left.id.localeCompare(right.id));
}

/**
 * The best agent for a team, or `null` when the team has no eligible active
 * agent. Callers that only need the winner use this; `getEligibleTeamAgents`
 * exposes the full ranking for tests and diagnostics.
 */
export async function findBestAgentForTeam(
  db: Prisma.TransactionClient,
  teamId: string,
): Promise<TeamAgentCandidate | null> {
  const [best] = await getEligibleTeamAgents(db, teamId);
  return best ?? null;
}

/**
 * Fill an unassigned team-owned ticket's assignee with the least-loaded eligible
 * agent on that team. Returns the chosen agent, or `null` when nothing was done
 * (no team, already assigned, terminal, no eligible agent, or a concurrent write
 * won the race).
 *
 * Hard invariants:
 *   - `teamId === null`            -> no-op (never infer a team)
 *   - `assignedAgentId !== null`   -> no-op (existing assignment is preserved,
 *                                     even if another agent is less loaded)
 *   - terminal status             -> no-op
 *
 * Race safety: the write is a conditional `updateMany` still guarded by
 * `assignedAgentId: null`, the same `teamId`, and an active status. If a manual
 * assignment, another auto-assign, or a status/team change landed first, the
 * guard matches zero rows and no history/audit/notification is written. Two
 * concurrent ticket creations can still both read workload `0` for the same
 * agent and both pick them (bounded imbalance of at most the concurrency width);
 * this is documented and acceptable for V1 — no lock, queue, or scheduler.
 */
export async function autoAssignTicket(
  db: Prisma.TransactionClient,
  input: AutoAssignInput,
): Promise<AutoAssignOutcome | null> {
  if (!input.teamId) return null;
  if (input.assignedAgentId) return null;
  if (isTerminalTicketStatus(input.status)) return null;

  const agent = await findBestAgentForTeam(db, input.teamId);
  if (!agent) return null;

  const { count } = await db.ticket.updateMany({
    where: {
      id: input.ticketId,
      assignedAgentId: null,
      teamId: input.teamId,
      status: { in: [...ASSIGNMENT_ACTIVE_STATUSES] },
    },
    data: { assignedAgentId: agent.id },
  });
  if (count !== 1) return null;

  // Canonical ticket history — automated actor is null; the semantic action name
  // matches the SLA-monitor auto-assignment so the trail reads consistently.
  await db.ticketHistory.create({
    data: {
      ticketId: input.ticketId,
      actorUserId: null,
      action: AUTO_ASSIGNMENT_HISTORY_ACTION,
      oldValue: null,
      newValue: agent.name,
    },
  });
  await createAuditLog(
    {
      actorId: null,
      action: AUDIT_ACTIONS.TICKET_ASSIGNED,
      entityType: AUDIT_ENTITY_TYPES.TICKET,
      entityId: input.ticketId,
      changes: { assignedAgentId: { from: null, to: agent.id } },
      metadata: { reason: AUTO_ASSIGNMENT_AUDIT_REASON },
    },
    db,
  );
  // Same assignment notification the agent would get from a normal assignment,
  // targeted only at the selected (in-team) agent.
  await createNotifications(
    db,
    [agent.id],
    AUTO_ASSIGNMENT_NOTIFICATION_TYPE,
    "Ticket automatically assigned",
    `Ticket #${input.ticketId} was automatically assigned to you`,
    input.ticketId,
  );

  return { assignedAgentId: agent.id, agentName: agent.name };
}

export const assignmentPolicy = { ASSIGNMENT_ACTIVE_STATUSES };
