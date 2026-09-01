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
 * Recipients for a NORMAL customer-reply notification (`CUSTOMER_REPLY`), shared
 * by every inbound channel (Customer Portal / WEB, WhatsApp, Email, SMS). This is
 * deliberately NARROWER than {@link ticketOperationalRecipientIds}: a routine
 * customer reply is ticket activity, not an operational escalation, so it must
 * NOT fan out to every ADMIN by role.
 *
 * Targets, deduplicated:
 *   - the assigned agent (when the ticket has one, and they are active)
 *   - the manager of the ticket's team — resolved from `teamId` ONLY (never
 *     inferred from the assignee's team); an unrouted ticket reaches no manager
 *   - every user explicitly watching the ticket (this is the only way an ADMIN
 *     receives a normal customer reply — by being a watcher)
 *
 * Fallback: when the above resolves to nobody — an unrouted, unassigned,
 * unwatched ticket, which in practice is a brand-new inbound WhatsApp/Email/SMS
 * ticket with no operational owner yet — every active ADMIN is notified so the
 * reply is not silently dropped. This is the smallest safety net, NOT a general
 * admin fan-out: any assigned OR team-routed ticket skips it entirely.
 *
 * `excludeUserId` drops the actor (the replying customer's user id on the portal
 * path). Authorization: every target already satisfies ticket visibility
 * (assignee, own-team manager, or a watcher added through a visibility check) —
 * this does not widen who can see the ticket.
 */
export async function customerReplyNotificationRecipientIds(
  db: Prisma.TransactionClient,
  opts: {
    ticketId: string;
    teamId: string | null;
    assignedAgentId?: string | null;
    excludeUserId?: string | null;
  },
): Promise<string[]> {
  const exclude = new Set([opts.excludeUserId].filter(Boolean) as string[]);
  const ids = new Set<string>();

  const staffOr: Prisma.UserWhereInput[] = [];
  if (opts.assignedAgentId) staffOr.push({ id: opts.assignedAgentId });
  // Team manager is keyed on Ticket.teamId — the source of truth. An unrouted
  // ticket (teamId null) never adds a manager clause.
  if (opts.teamId) staffOr.push({ role: Role.MANAGER, managedTeam: { id: opts.teamId } });
  if (staffOr.length > 0) {
    const staff = await db.user.findMany({ where: { isActive: true, OR: staffOr }, select: { id: true } });
    for (const user of staff) ids.add(user.id);
  }

  const watchers = await db.ticketWatcher.findMany({
    where: { ticketId: opts.ticketId },
    select: { userId: true },
  });
  for (const watcher of watchers) ids.add(watcher.userId);

  for (const id of exclude) ids.delete(id);

  if (ids.size === 0) {
    const admins = await db.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { id: true } });
    for (const admin of admins) if (!exclude.has(admin.id)) ids.add(admin.id);
  }

  return [...ids];
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
