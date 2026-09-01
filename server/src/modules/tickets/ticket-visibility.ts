import { Prisma, Role } from "@prisma/client";

export interface TicketActor { userId: string; role: Role }

export type TicketListScope = "mine" | "unassigned";

/**
 * Security boundary for reading/mutating a single ticket. AGENT may reach a
 * ticket assigned to themselves OR an unassigned one (queue pickup / self-claim);
 * ADMIN/MANAGER see everything. Used by getTicket / updateTicket / conversation /
 * watchers — do NOT narrow this to "assigned-only" or agents lose the ability to
 * open an unassigned ticket in order to claim it.
 */
export function ticketVisibilityWhere(actor: TicketActor): Prisma.TicketWhereInput {
  return actor.role === Role.AGENT ? { OR: [{ assignedAgentId: actor.userId }, { assignedAgentId: null }] } : {};
}

/**
 * Ticket-LIST scoping. AGENT lists are split into two explicit scopes and there
 * is no "all" — the default (undefined / "mine") is the agent's own tickets.
 * ADMIN/MANAGER lists are never scoped here (the `scope` param is ignored for
 * them and their full-access experience is unchanged).
 */
export function ticketListVisibilityWhere(actor: TicketActor, scope?: TicketListScope): Prisma.TicketWhereInput {
  if (actor.role !== Role.AGENT) return {};
  if (scope === "unassigned") return { assignedAgentId: null };
  return { assignedAgentId: actor.userId };
}
