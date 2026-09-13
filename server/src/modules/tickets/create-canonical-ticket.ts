import type { Prisma, TicketStatus } from "@prisma/client";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { autoAssignTicket } from "../assignment/assignment.service.js";

/**
 * CONV-013 — canonical ticket-creation seam (OD-CC-7).
 *
 * Creates the `Ticket`, its `TicketHistory(TICKET_CREATED)` row, and exactly
 * one canonical `AuditLog(TICKET_CREATED)`, then runs optional team-scoped
 * auto-assignment when no explicit assignee was supplied. Staff/manual
 * callers pass their authenticated actor id; Portal, provider, and Live Chat
 * callers pass `actorId: null` (OD-CC-7 — non-staff creation is actorless,
 * even when a Portal customer initiated the request).
 *
 * `historyActorId` defaults to `actorId` but can be overridden: Portal and
 * Live Chat keep the authenticated customer's own id on the `TicketHistory`
 * row (who did it) while the canonical `AuditLog` stays actorless (OD-CC-7 —
 * non-staff creation is actorless for audit purposes) — those two facts are
 * independent and this is the one place both call sites need to diverge.
 *
 * `select` extends (never replaces) the fields this helper itself needs
 * (`DEFAULT_SELECT`) — pass whatever additional columns/relations the caller's
 * response shape requires; the full merged-select record is returned as
 * `ticket` (already reflecting auto-assignment, no extra refetch needed by
 * the caller).
 *
 * Must run inside the caller's own `prisma.$transaction` (pass that
 * transaction client as `tx`) so ticket creation, history, audit, and
 * assignment commit atomically with the rest of that flow.
 */
export type CreateCanonicalTicketParams<S extends Prisma.TicketSelect = Record<string, never>> = {
  tx: Prisma.TransactionClient;
  data: Prisma.TicketUncheckedCreateInput;
  actorId: string | null;
  /** Overrides the `TicketHistory.actorUserId` when it must differ from `actorId` (see above). */
  historyActorId?: string | null;
  select?: S;
  /** Audit `changes` payload — id-only, never message/description bodies. */
  auditChanges?: Record<string, { to?: string | number | boolean | null; from?: string | number | boolean | null }>;
  requestContext?: AuditRequestContext;
  /** Run team-scoped auto-assignment when true and no explicit assignee was set. */
  autoAssign?: boolean;
};

const DEFAULT_SELECT = {
  id: true, subject: true, status: true, priority: true, channel: true,
  teamId: true, assignedAgentId: true, customerId: true,
} satisfies Prisma.TicketSelect;

export type CanonicalTicketResult<S extends Prisma.TicketSelect = Record<string, never>> = {
  ticketId: string;
  teamId: string | null;
  assignedAgentId: string | null;
  customerId: string;
  status: TicketStatus;
  ticket: Prisma.TicketGetPayload<{ select: typeof DEFAULT_SELECT }> & Prisma.TicketGetPayload<{ select: S }>;
};

export async function createCanonicalTicket<S extends Prisma.TicketSelect = Record<string, never>>(
  params: CreateCanonicalTicketParams<S>,
): Promise<CanonicalTicketResult<S>> {
  const { tx, data, actorId } = params;
  const select = { ...DEFAULT_SELECT, ...(params.select ?? {}) } as typeof DEFAULT_SELECT & S;
  type Selected = Prisma.TicketGetPayload<{ select: typeof DEFAULT_SELECT }> & Prisma.TicketGetPayload<{ select: S }>;
  const ticket = (await tx.ticket.create({ data, select })) as Selected;

  await tx.ticketHistory.create({
    data: { ticketId: ticket.id, actorUserId: params.historyActorId !== undefined ? params.historyActorId : actorId, action: "TICKET_CREATED", newValue: ticket.status },
  });

  await createAuditLog(
    {
      actorId,
      action: AUDIT_ACTIONS.TICKET_CREATED,
      entityType: AUDIT_ENTITY_TYPES.TICKET,
      entityId: ticket.id,
      changes: params.auditChanges ?? { status: { to: ticket.status } },
      requestContext: params.requestContext,
    },
    tx,
  );

  // Guarded on the request's own `data.assignedAgentId`/`data.teamId`, not the
  // created row's `ticket.assignedAgentId`/`ticket.teamId` — an explicit
  // assignee, or the absence of a team, in the request must skip
  // auto-assignment regardless of what the caller's `select` echoes back.
  const requestedAssigneeId = data.assignedAgentId ?? null;
  const requestedTeamId = data.teamId ?? null;
  let assignedAgentId: string | null = ticket.assignedAgentId ?? null;
  let finalTicket: Selected = ticket;
  if (params.autoAssign && !requestedAssigneeId && requestedTeamId) {
    const outcome = await autoAssignTicket(tx, {
      ticketId: ticket.id,
      teamId: requestedTeamId,
      assignedAgentId: null,
      status: ticket.status,
    });
    assignedAgentId = outcome?.assignedAgentId ?? null;
    if (assignedAgentId) {
      finalTicket = (await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, select })) as Selected;
    }
  }

  return {
    ticketId: ticket.id,
    teamId: ticket.teamId ?? null,
    assignedAgentId,
    customerId: ticket.customerId,
    status: ticket.status,
    ticket: finalTicket,
  };
}
