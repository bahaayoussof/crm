import { Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { deriveSla, SLA_WARNING_MINUTES } from "../../shared/sla/derive-sla.js";
import { ticketVisibilityWhere, type TicketActor } from "../tickets/ticket-visibility.js";

export const ACTIVE_STATUSES = [TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED] as const;

/** Rolling window (inclusive of today) for the dashboard opened/resolved activity series. */
export const ACTIVITY_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const dashboardTicketSelect = {
  id: true, subject: true, status: true, priority: true, updatedAt: true,
  firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true, resolvedAt: true, closedAt: true,
  customer: { select: { id: true, name: true } }, assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

type DashboardRecord = Prisma.TicketGetPayload<{ select: typeof dashboardTicketSelect }>;
export type PrimaryQueueType = "NEEDS_ATTENTION" | "MY_ASSIGNED_TICKETS";

export async function getDashboardOverview(actor: TicketActor, now = new Date()) {
  const visible = ticketVisibilityWhere(actor);
  const active = { ...visible, status: { in: [...ACTIVE_STATUSES] } } satisfies Prisma.TicketWhereInput;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const warningEnd = new Date(now.getTime() + SLA_WARNING_MINUTES * 60_000);
  const breached = slaWindowWhere(now);
  const atRisk = { NOT: breached, ...slaWindowWhere(warningEnd) } satisfies Prisma.TicketWhereInput;
  const ticketArgs = { select: dashboardTicketSelect, take: 10, orderBy: [{ updatedAt: "asc" as const }, { id: "asc" as const }] };
  const isAgent = actor.role === "AGENT";
  const primaryScope = isAgent ? { ...active, assignedAgentId: actor.userId } satisfies Prisma.TicketWhereInput : active;
  const activityStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (ACTIVITY_WINDOW_DAYS - 1)));

  const [openTickets, assignedToMe, unassignedTickets, slaBreached, slaAtRisk, resolvedToday, waitingCustomer, distribution, breachedRows, riskRows, urgentRows, highRows, mediumRows, lowRows, unassignedRows, oldestRows, activityRows] = await Promise.all([
    prisma.ticket.count({ where: active }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: actor.userId } }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: null } }),
    prisma.ticket.count({ where: andWhere(active, breached) }),
    prisma.ticket.count({ where: andWhere(active, atRisk) }),
    prisma.ticket.count({ where: { ...visible, resolvedAt: { gte: today, lt: tomorrow } } }),
    prisma.ticket.count({ where: { ...active, status: TicketStatus.WAITING_CUSTOMER } }),
    prisma.ticket.groupBy({ by: ["status"], where: visible, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.ticket.findMany({ where: andWhere(primaryScope, breached), ...ticketArgs }),
    prisma.ticket.findMany({ where: andWhere(primaryScope, atRisk), ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...primaryScope, priority: TicketPriority.URGENT }, ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...primaryScope, priority: TicketPriority.HIGH }, ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...primaryScope, priority: TicketPriority.MEDIUM }, ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...primaryScope, priority: TicketPriority.LOW }, ...ticketArgs }),
    prisma.ticket.findMany({ where: { ...active, assignedAgentId: null }, ...ticketArgs }),
    prisma.ticket.findMany({ where: primaryScope, ...ticketArgs }),
    prisma.ticket.findMany({
      where: andWhere(visible, { OR: [{ createdAt: { gte: activityStart, lte: now } }, { resolvedAt: { gte: activityStart, lte: now } }] }),
      select: { createdAt: true, resolvedAt: true },
    }),
  ]);

  const primaryQueueType: PrimaryQueueType = isAgent ? "MY_ASSIGNED_TICKETS" : "NEEDS_ATTENTION";
  const primaryCandidates = isAgent
    ? [breachedRows, riskRows, urgentRows, highRows, mediumRows, lowRows, oldestRows]
    : [breachedRows, urgentRows, riskRows, highRows, unassignedRows, oldestRows];
  const primaryTickets = dedupe(primaryCandidates.flat())
    .sort((a, b) => isAgent ? compareAssignedWork(a, b, now) : compareAttention(a, b, now))
    .slice(0, 10);
  const primaryIds = primaryTickets.map((ticket) => ticket.id);
  const recent = await prisma.ticket.findMany({
    where: andWhere(visible, { id: { notIn: primaryIds } }),
    select: dashboardTicketSelect,
    take: 8,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return {
    metrics: { openTickets, assignedToMe, unassignedTickets, slaAtRisk, slaBreached, resolvedToday, waitingCustomer },
    statusDistribution: distribution.map((item) => ({ status: item.status, count: item._count._all })),
    ticketActivity: buildTicketActivity(activityRows, activityStart),
    primaryQueueType,
    primaryTickets: primaryTickets.map((ticket) => serialize(ticket, now)),
    recentTickets: recent.map((ticket) => serialize(ticket, now)),
    generatedAt: now.toISOString(),
  };
}

/** UTC `YYYY-MM-DD` day key. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One `{ date, opened, resolved }` bucket per UTC day from `start` through today,
 * always `ACTIVITY_WINDOW_DAYS` long and zero-filled. `opened` counts `createdAt`,
 * `resolved` counts `resolvedAt`; rows outside the window are ignored defensively.
 */
function buildTicketActivity(rows: Array<{ createdAt: Date; resolvedAt: Date | null }>, start: Date) {
  const startTime = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const opened = new Map<string, number>();
  const resolved = new Map<string, number>();
  const keys: string[] = [];
  for (let index = 0; index < ACTIVITY_WINDOW_DAYS; index += 1) {
    const key = utcDayKey(new Date(startTime + index * DAY_MS));
    keys.push(key);
    opened.set(key, 0);
    resolved.set(key, 0);
  }
  for (const row of rows) {
    const createdKey = utcDayKey(row.createdAt);
    if (opened.has(createdKey)) opened.set(createdKey, (opened.get(createdKey) ?? 0) + 1);
    if (row.resolvedAt) {
      const resolvedKey = utcDayKey(row.resolvedAt);
      if (resolved.has(resolvedKey)) resolved.set(resolvedKey, (resolved.get(resolvedKey) ?? 0) + 1);
    }
  }
  return keys.map((date) => ({ date, opened: opened.get(date) ?? 0, resolved: resolved.get(date) ?? 0 }));
}

function slaWindowWhere(end: Date): Prisma.TicketWhereInput {
  return { OR: [{ firstRespondedAt: null, firstResponseDueAt: { lte: end } }, { resolutionDueAt: { lte: end } }] };
}
function andWhere(...where: Prisma.TicketWhereInput[]): Prisma.TicketWhereInput { return { AND: where }; }
function serialize(ticket: DashboardRecord, now: Date) {
  const sla = deriveSla(ticket, now);
  return { id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, updatedAt: ticket.updatedAt.toISOString(), effectiveSlaDueAt: sla.effectiveSlaDueAt, slaState: sla.slaState, customer: ticket.customer, assignedAgent: ticket.assignedAgent };
}
function dedupe(records: DashboardRecord[]) { return [...new Map(records.map((item) => [item.id, item])).values()]; }
function compareAttention(a: DashboardRecord, b: DashboardRecord, now: Date) {
  const rank = (ticket: DashboardRecord) => { const sla = deriveSla(ticket, now).slaState; return sla === "BREACHED" ? 0 : ticket.priority === TicketPriority.URGENT ? 1 : sla === "AT_RISK" ? 2 : ticket.priority === TicketPriority.HIGH ? 3 : ticket.assignedAgent === null ? 4 : 5; };
  return rank(a) - rank(b) || a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id);
}
function compareAssignedWork(a: DashboardRecord, b: DashboardRecord, now: Date) {
  const rank = (ticket: DashboardRecord) => {
    const sla = deriveSla(ticket, now).slaState;
    if (sla === "BREACHED") return 0;
    if (sla === "AT_RISK") return 1;
    return 2 + [TicketPriority.URGENT, TicketPriority.HIGH, TicketPriority.MEDIUM, TicketPriority.LOW].indexOf(ticket.priority);
  };
  return rank(a) - rank(b) || a.updatedAt.getTime() - b.updatedAt.getTime() || a.id.localeCompare(b.id);
}
