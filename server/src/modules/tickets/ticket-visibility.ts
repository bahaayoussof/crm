import { Prisma, Role } from "@prisma/client";

export interface TicketActor { userId: string; role: Role }

export type TicketListScope = "mine" | "unassigned";

/**
 * Optional TEAM narrowing (feature/team-based-manager-scope). Resolve the actor's
 * team once per request via `resolveActorTeamId` and pass `{ teamId }` here to
 * enforce team isolation. Omit the argument for the legacy organization-wide
 * behavior (still used by call sites not yet migrated to team scope).
 *
 *   present with a teamId → restrict to that team
 *   present with teamId null → match nothing (MANAGER/AGENT with no team)
 *   absent → no team narrowing
 */
export interface TeamScope { teamId: string | null }

/** A `where` fragment that can never match a row. */
const MATCH_NOTHING: Prisma.TicketWhereInput = { id: { in: [] } };

/**
 * Security boundary for reading/mutating a single ticket. Used by getTicket /
 * updateTicket / conversation / watchers.
 *
 *   ADMIN    → every ticket
 *   MANAGER  → org-wide (no `team`) or their own team's tickets (`team` given)
 *   AGENT    → a ticket assigned to themselves, OR an unassigned ticket (queue
 *              pickup / self-claim). With `team`, the unassigned branch is
 *              restricted to the agent's own team.
 */
export function ticketVisibilityWhere(actor: TicketActor, team?: TeamScope): Prisma.TicketWhereInput {
  if (actor.role === Role.MANAGER) {
    if (!team) return {};
    return team.teamId ? { teamId: team.teamId } : MATCH_NOTHING;
  }
  if (actor.role === Role.AGENT) {
    const unassigned: Prisma.TicketWhereInput = team
      ? team.teamId
        ? { assignedAgentId: null, teamId: team.teamId }
        : MATCH_NOTHING
      : { assignedAgentId: null };
    return { OR: [{ assignedAgentId: actor.userId }, unassigned] };
  }
  return {};
}

/**
 * Ticket-LIST scoping.
 *
 *   ADMIN    → all
 *   MANAGER  → org-wide (no `team`) or their own team (`team` given)
 *   AGENT    → `mine` (default): own assigned tickets;
 *              `unassigned`: unassigned tickets, restricted to the agent's own
 *              team when `team` is given. There is no "all" scope for an agent.
 */
export function ticketListVisibilityWhere(
  actor: TicketActor,
  scope?: TicketListScope,
  team?: TeamScope,
): Prisma.TicketWhereInput {
  if (actor.role === Role.MANAGER) {
    if (!team) return {};
    return team.teamId ? { teamId: team.teamId } : MATCH_NOTHING;
  }
  if (actor.role !== Role.AGENT) return {};
  if (scope === "unassigned") {
    if (!team) return { assignedAgentId: null };
    return team.teamId ? { assignedAgentId: null, teamId: team.teamId } : MATCH_NOTHING;
  }
  return { assignedAgentId: actor.userId };
}
