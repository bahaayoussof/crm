import { Role, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { createNotifications } from "../notifications/notification.service.js";

const ACTIVE_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;
const ESCALATABLE_STATUSES = ACTIVE_STATUSES.filter((status) => status !== TicketStatus.ESCALATED);
export const SLA_MONITOR_BATCH_SIZE = 100;

type EligibleAgent = {
  id: string;
  name: string;
  departmentId: string | null;
  branchId: string | null;
  activeTicketCount: number;
};

export interface SlaMonitorResult {
  assigned: number;
  escalated: number;
  inspected: { unassigned: number; breached: number };
  generatedAt: string;
}

export async function runSlaMonitor(now = new Date()): Promise<SlaMonitorResult> {
  const assignment = await assignUnassignedTickets();
  const escalation = await escalateBreachedTickets(now);
  return {
    assigned: assignment.updated,
    escalated: escalation.updated,
    inspected: { unassigned: assignment.inspected, breached: escalation.inspected },
    generatedAt: now.toISOString(),
  };
}

async function assignUnassignedTickets() {
  const [tickets, agentRows] = await Promise.all([
    prisma.ticket.findMany({
      where: { assignedAgentId: null, status: { in: [...ACTIVE_STATUSES] } },
      take: SLA_MONITOR_BATCH_SIZE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, subject: true, departmentId: true, branchId: true },
    }),
    prisma.user.findMany({
      where: { role: Role.AGENT, isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        departmentId: true,
        branchId: true,
        _count: { select: { assignedTickets: { where: { status: { in: [...ACTIVE_STATUSES] } } } } },
      },
    }),
  ]);

  const agents: EligibleAgent[] = agentRows.map((agent) => ({
    id: agent.id,
    name: agent.name,
    departmentId: agent.departmentId,
    branchId: agent.branchId,
    activeTicketCount: agent._count.assignedTickets,
  }));
  let updated = 0;

  for (const ticket of tickets) {
    const agent = chooseAgent(agents, ticket);
    if (!agent) continue;

    const assigned = await prisma.$transaction(async (tx) => {
      const mutation = await tx.ticket.updateMany({
        where: { id: ticket.id, assignedAgentId: null, status: { in: [...ACTIVE_STATUSES] } },
        data: { assignedAgentId: agent.id },
      });
      if (mutation.count !== 1) return false;

      await tx.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorUserId: null,
          action: "AUTO_ASSIGNMENT",
          oldValue: null,
          newValue: agent.name,
        },
      });
      await createNotifications(
        tx,
        [agent.id],
        "TICKET_AUTO_ASSIGNED",
        "Ticket automatically assigned",
        `Ticket #${ticket.id}: ${ticket.subject} was automatically assigned to you`,
        ticket.id,
      );
      return true;
    });

    if (assigned) {
      updated += 1;
      agent.activeTicketCount += 1;
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
    select: { id: true, subject: true, status: true },
  });
  let updated = 0;

  for (const ticket of tickets) {
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
      const recipients = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
        select: { id: true },
      });
      await createNotifications(
        tx,
        recipients.map((recipient) => recipient.id),
        "SLA_BREACH_ESCALATION",
        "Ticket escalated after SLA breach",
        `Ticket #${ticket.id}: ${ticket.subject} breached its resolution SLA and was escalated`,
        ticket.id,
      );
      return true;
    });
    if (escalated) updated += 1;
  }
  return { inspected: tickets.length, updated };
}

function chooseAgent(
  agents: EligibleAgent[],
  ticket: { departmentId: string | null; branchId: string | null },
) {
  return agents
    .filter((agent) =>
      (ticket.departmentId === null || agent.departmentId === ticket.departmentId) &&
      (ticket.branchId === null || agent.branchId === ticket.branchId),
    )
    .sort((left, right) => left.activeTicketCount - right.activeTicketCount || left.id.localeCompare(right.id))[0];
}

export const slaAutomationPolicy = { ACTIVE_STATUSES, ESCALATABLE_STATUSES };
