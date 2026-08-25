import { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { ticketVisibilityWhere, type TicketActor } from "../tickets/ticket-visibility.js";

export const ACTIVE_STATUSES = [TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED] as const;
export const SLA_WARNING_MINUTES = 60;

const dashboardTicketSelect = {
  id: true, subject: true, status: true, priority: true, updatedAt: true,
  firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true, resolvedAt: true, closedAt: true,
  customer: { select: { id: true, name: true } }, assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

type DashboardRecord = Prisma.TicketGetPayload<{ select: typeof dashboardTicketSelect }>;
export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED";

export async function getDashboardOverview(actor: TicketActor, now = new Date()) {
  const visible = ticketVisibilityWhere(actor);
  const active = { ...visible, status: { in: [...ACTIVE_STATUSES] } } satisfies Prisma.TicketWhereInput;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const warningEnd = new Date(now.getTime() + SLA_WARNING_MINUTES * 60_000);
  const breached = slaWindowWhere(now);
  const atRisk = { NOT: breached, ...slaWindowWhere(warningEnd) } satisfies Prisma.TicketWhereInput;
  const ticketArgs = { select: dashboardTicketSelect, take: 10, orderBy: [{ updatedAt: "asc" as const }, { id: "asc" as const }] };

  const [openTickets, assignedToMe, unassignedTickets, slaBreached, slaAtRisk, resolvedToday, waitingCustomer, distribution, recent, breachedRows, urgentRows, riskRows, highRows, unassignedRows, oldestRows] = await Promise.all([
    prisma.ticket.count({ where: active }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: actor.userId } }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: null } }),
    prisma.ticket.count({ where: andWhere(active, breached) }),
    prisma.ticket.count({ where: andWhere(active, atRisk) }),
    prisma.ticket.count({ where: { ...visible, resolvedAt: { gte: today, lt: tomorrow } } }),
    prisma.ticket.count({ where: { ...active, status: TicketStatus.WAITING_CUSTOMER } }),
    prisma.ticket.groupBy({ by: ["status"], where: visible, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.ticket.findMany({ where: visible, select: dashboardTicketSelect, take: 8, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] }),
    prisma.ticket.findMany({ where: andWhere(active, breached), ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...active, priority: TicketPriority.URGENT }, ...ticketArgs }),
    prisma.ticket.findMany({ where: andWhere(active, atRisk), ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...active, priority: TicketPriority.HIGH }, ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...active, assignedAgentId: null }, ...ticketArgs }),
    prisma.ticket.findMany({ where: active, ...ticketArgs }),
  ]);

  const attention = dedupe([breachedRows, urgentRows, riskRows, highRows, unassignedRows, oldestRows].flat()).sort((a, b) => compareAttention(a, b, now)).slice(0, 10);
  return {
    metrics: { openTickets, assignedToMe, unassignedTickets, slaAtRisk, slaBreached, resolvedToday, waitingCustomer },
    statusDistribution: distribution.map((item) => ({ status: item.status, count: item._count._all })),
    needsAttention: attention.map((ticket) => serialize(ticket, now)), recentTickets: recent.map((ticket) => serialize(ticket, now)),
    generatedAt: now.toISOString(),
  };
}

export function deriveSla(ticket: Pick<DashboardRecord, "status" | "firstResponseDueAt" | "firstRespondedAt" | "resolutionDueAt" | "resolvedAt" | "closedAt">, now: Date) {
  if (ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED || ticket.resolvedAt || ticket.closedAt) return { effectiveSlaDueAt: null, slaState: "MET" as const };
  const deadlines = [ticket.firstRespondedAt ? null : ticket.firstResponseDueAt, ticket.resolutionDueAt].filter((value): value is Date => value !== null);
  if (!deadlines.length) return { effectiveSlaDueAt: null, slaState: ticket.firstRespondedAt && ticket.firstResponseDueAt ? "MET" as const : "NOT_CONFIGURED" as const };
  const effectiveSlaDueAt = new Date(Math.min(...deadlines.map((value) => value.getTime())));
  const remaining = effectiveSlaDueAt.getTime() - now.getTime();
  const slaState: SlaState = remaining <= 0 ? "BREACHED" : remaining <= SLA_WARNING_MINUTES * 60_000 ? "AT_RISK" : "ON_TRACK";
  return { effectiveSlaDueAt: effectiveSlaDueAt.toISOString(), slaState };
}

function slaWindowWhere(end: Date): Prisma.TicketWhereInput {
  return { OR: [{ firstRespondedAt: null, firstResponseDueAt: { lte: end } }, { resolutionDueAt: { lte: end } }] };
}
function andWhere(...where: Prisma.TicketWhereInput[]): Prisma.TicketWhereInput { return { AND: where }; }
function serialize(ticket: DashboardRecord, now: Date) {
  return { id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, updatedAt: ticket.updatedAt.toISOString(), ...deriveSla(ticket, now), customer: ticket.customer, assignedAgent: ticket.assignedAgent };
}
function dedupe(records: DashboardRecord[]) { return [...new Map(records.map((item) => [item.id, item])).values()]; }
function compareAttention(a: DashboardRecord, b: DashboardRecord, now: Date) {
  const rank = (ticket: DashboardRecord) => { const sla = deriveSla(ticket, now).slaState; return sla === "BREACHED" ? 0 : ticket.priority === TicketPriority.URGENT ? 1 : sla === "AT_RISK" ? 2 : ticket.priority === TicketPriority.HIGH ? 3 : ticket.assignedAgent === null ? 4 : 5; };
  return rank(a) - rank(b) || a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id);
}
