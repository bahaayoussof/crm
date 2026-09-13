import { TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { createNotifications } from "../notifications/notification.service.js";
import { emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { autoAssignTicket } from "../assignment/assignment.service.js";
import { ASSIGNMENT_ACTIVE_STATUSES } from "../assignment/assignment.types.js";
import { ticketOperationalRecipientIds } from "../../shared/team/team-scope.js";

// The bounded SLA-monitor cron discovers *candidate tickets* only. The
// assignment decision itself is delegated to the single canonical engine in
// modules/assignment (`autoAssignTicket`, ADR-051), so there is exactly one
// automatic-assignment policy: `Ticket.teamId` is the authoritative ownership
// boundary. Department/Branch are NOT used as substitutes for Team ownership and
// a ticket with `teamId = null` is intentionally left unassigned for ADMIN
// routing — the cron never infers or invents a Team.
const ACTIVE_STATUSES = ASSIGNMENT_ACTIVE_STATUSES;
const ESCALATABLE_STATUSES = ACTIVE_STATUSES.filter((status) => status !== TicketStatus.ESCALATED);
export const SLA_MONITOR_BATCH_SIZE = 100;

export interface SlaMonitorResult {
  assigned: number;
  escalated: number;
  inspected: { unassigned: number; breached: number };
  generatedAt: string;
}

export async function runSlaMonitor(now = new Date()): Promise<SlaMonitorResult> {
 return withRealtimeOutbox(async () => {
  const assignment = await assignUnassignedTickets();
  const escalation = await escalateBreachedTickets(now);
  return {
    assigned: assignment.updated,
    escalated: escalation.updated,
    inspected: { unassigned: assignment.inspected, breached: escalation.inspected },
    generatedAt: now.toISOString(),
  };
 });
}

async function assignUnassignedTickets() {
  // Candidate discovery is SLA-specific: unassigned, active-status, oldest first,
  // bounded batch. Team routing is authoritative — an unrouted ticket
  // (`teamId = null`) is excluded here and stays unassigned; the cron never
  // infers a Team from Department/Branch/category/customer/previous assignee.
  const tickets = await prisma.ticket.findMany({
    where: { assignedAgentId: null, teamId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
    take: SLA_MONITOR_BATCH_SIZE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, customerId: true, teamId: true, status: true },
  });
  let updated = 0;

  for (const ticket of tickets) {
    // Delegate the actual assignment to the canonical engine: it re-reads the
    // ticket + team-scoped eligible agents inside the transaction, applies the
    // least-workload / deterministic tie-break strategy, runs the same guarded
    // `updateMany`, and writes the canonical history / audit / notification.
    // Each ticket commits before the next, so intra-run workload stays accurate.
    //
    // Isolated per candidate: a single transaction failure (e.g. a Neon
    // interactive-transaction timeout under real latency) must not abort the
    // whole batch — every earlier candidate in this run has already committed
    // its own transaction, so aborting the loop would only silently drop their
    // buffered realtime events without undoing any persisted state. Skip the
    // failed candidate and let the next scheduled run retry it.
    try {
      const outcome = await prisma.$transaction((tx) =>
        autoAssignTicket(tx, {
          ticketId: ticket.id,
          teamId: ticket.teamId,
          assignedAgentId: null,
          status: ticket.status,
        }),
      );

      if (outcome) {
        updated += 1;
        emitTicketUpdated({
          ticketId: ticket.id,
          assignedAgentId: outcome.assignedAgentId,
          customerId: ticket.customerId,
          teamId: ticket.teamId,
        });
      }
    } catch (error) {
      console.error(`sla-automation: assignment failed for ticket ${ticket.id}`, error);
    }
  }
  return { inspected: tickets.length, updated };
}

async function escalateBreachedTickets(now: Date) {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: [...ESCALATABLE_STATUSES] },
      resolutionDueAt: { not: null, lte: now },
      resolvedAt: null,
      closedAt: null,
    },
    take: SLA_MONITOR_BATCH_SIZE,
    orderBy: [{ resolutionDueAt: "asc" }, { id: "asc" }],
    select: { id: true, subject: true, status: true, assignedAgentId: true, customerId: true, teamId: true },
  });
  let updated = 0;

  for (const ticket of tickets) {
    // Isolated per candidate — see the matching comment in
    // `assignUnassignedTickets`: one candidate's transaction failure must not
    // abort the whole batch or drop already-committed events from earlier
    // candidates in this same run.
    try {
      const escalated = await prisma.$transaction(async (tx) => {
        const mutation = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
            status: ticket.status,
            resolutionDueAt: { not: null, lte: now },
            resolvedAt: null,
            closedAt: null,
          },
          data: { status: TicketStatus.ESCALATED },
        });
        if (mutation.count !== 1) return false;

        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            actorUserId: null,
            action: "SLA_AUTO_ESCALATED",
            oldValue: ticket.status,
            newValue: TicketStatus.ESCALATED,
          },
        });
        await createAuditLog({ actorId: null, action: AUDIT_ACTIONS.TICKET_ESCALATED, entityType: AUDIT_ENTITY_TYPES.TICKET, entityId: ticket.id, changes: { status: { from: ticket.status, to: TicketStatus.ESCALATED } }, metadata: { reason: "sla_breach" } }, tx);
        // Team-aware operational recipients — the SAME helper the manual
        // ESCALATED transition uses (ticket.service.ts `updateTicket`): every
        // active ADMIN, the manager of this ticket's team (unrouted -> no
        // manager), and the ticket's own assigned agent, when it has one. The
        // automatic path previously hand-rolled a narrower ADMIN+manager-only
        // query that silently excluded the assignee from their own ticket's
        // breach notification — reusing the shared helper closes that gap and
        // keeps both escalation paths consistent.
        const recipients = await ticketOperationalRecipientIds(tx, {
          teamId: ticket.teamId,
          assignedAgentId: ticket.assignedAgentId,
        });
        await createNotifications(
          tx,
          recipients,
          "SLA_BREACH_ESCALATION",
          "Ticket escalated after SLA breach",
          `Ticket #${ticket.id}: ${ticket.subject} breached its resolution SLA and was escalated`,
          ticket.id,
        );
        return true;
      });
      if (escalated) {
        updated += 1;
        emitTicketUpdated({
          ticketId: ticket.id,
          assignedAgentId: ticket.assignedAgentId,
          customerId: ticket.customerId,
          teamId: ticket.teamId,
        });
      }
    } catch (error) {
      console.error(`sla-automation: escalation failed for ticket ${ticket.id}`, error);
    }
  }
  return { inspected: tickets.length, updated };
}

export const slaAutomationPolicy = { ACTIVE_STATUSES, ESCALATABLE_STATUSES };
