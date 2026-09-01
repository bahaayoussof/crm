import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../errors/app-error.js";
import type { TeamScope } from "../../modules/tickets/ticket-visibility.js";

/**
 * Team-based authorization scope (feature/team-based-manager-scope).
 *
 *   Department ─▶ Team ─▶ { Manager, Agents, Tickets }
 *
 *   ADMIN   → organization-wide (no team scope)
 *   MANAGER → their own Team only (Team.managerId === userId)
 *   AGENT   → their own Team (User.teamId) + the existing agent ticket restrictions
 *   CUSTOMER→ not handled here (portal boundary owns customer scope)
 *
 * This module is the single source of truth for team scoping. Do NOT re-implement
 * `if (role === MANAGER)` team checks in individual controllers/services — resolve
 * the actor's team id once (`resolveActorTeamId`) and pass it into the pure
 * `where`-builders below. The backend is always authoritative; the frontend only
 * mirrors this for UX.
 */

export interface ScopeActor {
  userId: string;
  role: Role;
}

/**
 * The team a user operates within.
 *   MANAGER → the team they manage (unique `Team.managerId`)
 *   AGENT   → their membership team (`User.teamId`)
 *   ADMIN / other → null (no scope — org-wide)
 *
 * Returns `null` for a MANAGER/AGENT who has not been placed on a team
 * (mis-provisioned). Callers treat `null` for those roles as "scope matches
 * nothing" via {@link teamScopedTicketWhere} / {@link teamScopedAgentWhere}.
 */
export async function resolveActorTeamId(actor: ScopeActor): Promise<string | null> {
  if (actor.role !== Role.MANAGER && actor.role !== Role.AGENT) return null;
  // One query covers both roles: an AGENT's membership team (`teamId`) and a
  // MANAGER's led team (`managedTeam`). For a MANAGER the led team is
  // authoritative for scope even if their membership `teamId` drifted.
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { teamId: true, managedTeam: { select: { id: true } } },
  });
  if (!user) return null;
  if (actor.role === Role.MANAGER) return user.managedTeam?.id ?? user.teamId ?? null;
  return user.teamId ?? null;
}

/**
 * The team-scope argument every ticket-resource query should pass to
 * `ticketVisibilityWhere` / `ticketListVisibilityWhere`.
 *
 *   ADMIN  → `undefined` (no team narrowing)
 *   MANAGER / AGENT → `{ teamId }` (teamId may be `null` — the visibility
 *            helpers then match nothing on the scoped branch)
 *
 * This is the ONE way for a ticket-owned child-resource module (attachments,
 * tasks, collaboration, AI, …) to obtain team scope. Do not hand-roll
 * `ticket.teamId !== actorTeamId` checks in those modules.
 */
export async function resolveActorTeamScope(actor: ScopeActor): Promise<TeamScope | undefined> {
  if (actor.role !== Role.MANAGER && actor.role !== Role.AGENT) return undefined;
  return { teamId: await resolveActorTeamId(actor) };
}

/** A `where` fragment that can never match any row (empty `IN` list). */
export const MATCH_NOTHING: Prisma.TicketWhereInput = { id: { in: [] } };

/**
 * Ticket `where` fragment for a MANAGER's team scope.
 *   ADMIN                     → `{}` (all tickets)
 *   MANAGER with a team       → `{ teamId }`
 *   MANAGER without a team    → matches nothing
 *   AGENT / other             → `{}` (their scope is layered on separately by the
 *                                ticket-visibility helpers)
 */
export function teamScopedTicketWhere(actor: ScopeActor, teamId: string | null): Prisma.TicketWhereInput {
  if (actor.role !== Role.MANAGER) return {};
  return teamId ? { teamId } : MATCH_NOTHING;
}

/**
 * User `where` fragment for the AGENTS a caller supervises / may see.
 *   ADMIN                     → every active agent
 *   MANAGER with a team       → active agents on that team
 *   MANAGER without a team    → matches nothing
 *   AGENT / other             → every active agent (callers layer their own limits)
 */
export function teamScopedAgentWhere(actor: ScopeActor, teamId: string | null): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: Role.AGENT, isActive: true };
  if (actor.role !== Role.MANAGER) return base;
  return teamId ? { ...base, teamId } : { id: { in: [] } };
}

/**
 * IDOR-safe guard for a single ticket reached by id (GET/PATCH/conversation).
 * A MANAGER may only touch a ticket owned by their team; anything else is a 404
 * (never 403 — do not leak the existence of another team's ticket). No-op for
 * ADMIN / AGENT (the agent boundary is enforced by `ticket-visibility.ts`).
 */
export function assertManagerTicketAccess(
  actor: ScopeActor,
  actorTeamId: string | null,
  ticketTeamId: string | null,
): void {
  if (actor.role !== Role.MANAGER) return;
  if (!actorTeamId || ticketTeamId !== actorTeamId) {
    throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }
}

/**
 * Recipients for an OPERATIONAL ticket notification (customer reply, escalation,
 * SLA breach). Team-aware (feature/team-based-manager-scope):
 *
 *   - every active ADMIN
 *   - the manager of the ticket's team (only when `teamId` is set — an UNROUTED
 *     ticket never notifies any manager)
 *   - the assigned agent, when `assignedAgentId` is given
 *
 * `excludeUserId` drops the actor who triggered the event. Pass a `tx` client
 * when inside a transaction; the global `prisma` also satisfies the type.
 */
export async function ticketOperationalRecipientIds(
  db: Prisma.TransactionClient,
  opts: { teamId: string | null; assignedAgentId?: string | null; excludeUserId?: string | null },
): Promise<string[]> {
  const or: Prisma.UserWhereInput[] = [{ role: Role.ADMIN }];
  if (opts.teamId) or.push({ role: Role.MANAGER, managedTeam: { id: opts.teamId } });
  if (opts.assignedAgentId) or.push({ id: opts.assignedAgentId });
  const users = await db.user.findMany({
    where: {
      isActive: true,
      ...(opts.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
      OR: or,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Assignment invariant (Phase 10): a ticket may only be assigned to an agent on
 * the SAME team. Never silently moves the agent, the ticket, or team ownership —
 * returns a structured error the client can surface.
 *
 * `ticketTeamId` is the ticket's CURRENT owning team. If it is null (not yet
 * routed) the ticket adopts the agent's team, which the caller must persist.
 */
export function assertAgentAssignableToTicket(
  ticketTeamId: string | null,
  agentTeamId: string | null,
): void {
  if (!agentTeamId) {
    throw new AppError(409, "AGENT_HAS_NO_TEAM", "This agent is not assigned to a team and cannot take tickets");
  }
  if (ticketTeamId && ticketTeamId !== agentTeamId) {
    throw new AppError(
      409,
      "CROSS_TEAM_ASSIGNMENT",
      "The agent belongs to a different team than this ticket. Move the ticket to the agent's team first.",
    );
  }
}
