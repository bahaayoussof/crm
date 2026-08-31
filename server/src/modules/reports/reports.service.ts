import { Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import type { ReportsRange } from "./reports.schema.js";

const DAY_MS = 86_400_000;

/** Statuses that still count as unresolved work. */
const ACTIVE_STATUSES: TicketStatus[] = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
];

const PRIORITIES: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.URGENT,
];

const reportTicketSelect = {
  id: true,
  status: true,
  priority: true,
  categoryId: true,
  assignedAgentId: true,
  createdAt: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
} satisfies Prisma.TicketSelect;

type ReportTicket = Prisma.TicketGetPayload<{ select: typeof reportTicketSelect }>;
type SlaOutcome = "MET" | "BREACHED" | "PENDING" | "NONE";

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Every ticket that either entered or was resolved inside the window. Resolved
 * counts must include tickets created before the window, so both timestamps are
 * matched here and the per-metric cohort is narrowed in memory.
 */
async function loadTickets(range: ReportsRange): Promise<ReportTicket[]> {
  return prisma.ticket.findMany({
    where: {
      OR: [
        { createdAt: { gte: range.start, lte: range.end } },
        { resolvedAt: { gte: range.start, lte: range.end } },
      ],
      // Optional organizational scoping — ANDed with the date window by Prisma.
      ...(range.departmentId ? { departmentId: range.departmentId } : {}),
      ...(range.branchId ? { branchId: range.branchId } : {}),
    },
    select: reportTicketSelect,
    orderBy: { createdAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Predicates / math
// ---------------------------------------------------------------------------

function within(date: Date | null | undefined, range: ReportsRange): boolean {
  return date != null && date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

const createdInRange = (ticket: ReportTicket, range: ReportsRange) => within(ticket.createdAt, range);
const resolvedInRange = (ticket: ReportTicket, range: ReportsRange) => within(ticket.resolvedAt, range);

function firstResponseOutcome(ticket: ReportTicket, now: Date): SlaOutcome {
  if (!ticket.firstResponseDueAt) return "NONE";
  if (ticket.firstRespondedAt) {
    return ticket.firstRespondedAt.getTime() <= ticket.firstResponseDueAt.getTime() ? "MET" : "BREACHED";
  }
  return now.getTime() > ticket.firstResponseDueAt.getTime() ? "BREACHED" : "PENDING";
}

function resolutionOutcome(ticket: ReportTicket, now: Date): SlaOutcome {
  if (!ticket.resolutionDueAt) return "NONE";
  const completedAt = ticket.resolvedAt ?? ticket.closedAt;
  if (completedAt) {
    return completedAt.getTime() <= ticket.resolutionDueAt.getTime() ? "MET" : "BREACHED";
  }
  return now.getTime() > ticket.resolutionDueAt.getTime() ? "BREACHED" : "PENDING";
}

function compliancePct(met: number, breached: number): number | null {
  const total = met + breached;
  return total === 0 ? null : Math.round((met / total) * 100);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}

function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Ordered list of UTC day keys spanning the range, inclusive. */
function dayKeys(range: ReportsRange): string[] {
  const start = Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), range.start.getUTCDate());
  const end = Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), range.end.getUTCDate());
  const keys: string[] = [];
  for (let time = start; time <= end; time += DAY_MS) {
    keys.push(new Date(time).toISOString().slice(0, 10));
  }
  return keys;
}

function buildVolume(tickets: ReportTicket[], range: ReportsRange) {
  const keys = dayKeys(range);
  const created = new Map<string, number>(keys.map((key) => [key, 0]));
  const resolved = new Map<string, number>(keys.map((key) => [key, 0]));
  for (const ticket of tickets) {
    if (createdInRange(ticket, range)) {
      const key = utcDayKey(ticket.createdAt);
      created.set(key, (created.get(key) ?? 0) + 1);
    }
    if (resolvedInRange(ticket, range) && ticket.resolvedAt) {
      const key = utcDayKey(ticket.resolvedAt);
      resolved.set(key, (resolved.get(key) ?? 0) + 1);
    }
  }
  return keys.map((date) => ({ date, created: created.get(date) ?? 0, resolved: resolved.get(date) ?? 0 }));
}

function rangeMeta(range: ReportsRange) {
  return { range: { from: range.start.toISOString(), to: range.end.toISOString() }, timezone: "UTC" as const };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function getReportsOverview(range: ReportsRange, now = new Date()) {
  const [tickets, feedback] = await Promise.all([
    loadTickets(range),
    prisma.feedback.findMany({
      where: { createdAt: { gte: range.start, lte: range.end } },
      select: { rating: true },
    }),
  ]);

  const cohort = tickets.filter((ticket) => createdInRange(ticket, range));
  const createdTickets = cohort.length;
  const resolvedTickets = tickets.filter((ticket) => resolvedInRange(ticket, range)).length;

  let frMet = 0;
  let frBreached = 0;
  const firstResponseMinutes: number[] = [];
  for (const ticket of cohort) {
    const outcome = firstResponseOutcome(ticket, now);
    if (outcome === "MET") frMet += 1;
    if (outcome === "BREACHED") frBreached += 1;
    if (ticket.firstRespondedAt) firstResponseMinutes.push(minutesBetween(ticket.createdAt, ticket.firstRespondedAt));
  }

  const ratings = feedback.map((entry) => entry.rating);
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratings.filter((value) => value === rating).length,
  }));
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100) / 100
    : null;

  const statusDistribution = distributionByStatus(cohort);

  return {
    ...rangeMeta(range),
    kpis: {
      createdTickets,
      resolvedTickets,
      slaCompliancePct: compliancePct(frMet, frBreached),
      averageFirstResponseMinutes: average(firstResponseMinutes),
      satisfaction: { averageRating, responseCount: ratings.length },
    },
    ticketVolume: buildVolume(tickets, range),
    statusDistribution,
    satisfaction: { averageRating, responseCount: ratings.length, distribution: ratingDistribution },
    generatedAt: now.toISOString(),
  };
}

export async function getTicketReports(range: ReportsRange, now = new Date()) {
  const tickets = await loadTickets(range);
  const cohort = tickets.filter((ticket) => createdInRange(ticket, range));

  const byPriority = PRIORITIES.map((priority) => ({
    priority,
    created: cohort.filter((ticket) => ticket.priority === priority).length,
    resolved: tickets.filter((ticket) => ticket.priority === priority && resolvedInRange(ticket, range)).length,
  }));

  const categories = await prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const categoryCounts = new Map<string | null, number>();
  for (const ticket of cohort) {
    categoryCounts.set(ticket.categoryId, (categoryCounts.get(ticket.categoryId) ?? 0) + 1);
  }
  const byCategory = [...categoryCounts.entries()]
    .map(([categoryId, created]) => ({
      categoryId,
      categoryName: categoryId ? categoryName.get(categoryId) ?? categoryId : null,
      created,
    }))
    .sort((a, b) => b.created - a.created || String(a.categoryName).localeCompare(String(b.categoryName)));

  return {
    ...rangeMeta(range),
    totals: {
      created: cohort.length,
      resolved: tickets.filter((ticket) => resolvedInRange(ticket, range)).length,
      open: cohort.filter((ticket) => ACTIVE_STATUSES.includes(ticket.status)).length,
    },
    volume: buildVolume(tickets, range),
    byStatus: distributionByStatus(cohort),
    byPriority,
    byCategory,
    generatedAt: now.toISOString(),
  };
}

export async function getAgentReports(range: ReportsRange, now = new Date()) {
  const [tickets, agents] = await Promise.all([
    loadTickets(range),
    prisma.user.findMany({ where: { role: Role.AGENT }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  for (const ticket of tickets) {
    if (ticket.assignedAgentId && !names.has(ticket.assignedAgentId)) names.set(ticket.assignedAgentId, ticket.assignedAgentId);
  }

  const rows = [...names.entries()].map(([agentId, agentName]) => {
    const assignedCohort = tickets.filter((ticket) => ticket.assignedAgentId === agentId && createdInRange(ticket, range));
    const resolved = tickets.filter(
      (ticket) => ticket.assignedAgentId === agentId && resolvedInRange(ticket, range),
    ).length;
    const open = assignedCohort.filter((ticket) => ACTIVE_STATUSES.includes(ticket.status)).length;

    let slaMet = 0;
    let slaBreached = 0;
    const firstResponseMinutes: number[] = [];
    for (const ticket of assignedCohort) {
      const outcome = firstResponseOutcome(ticket, now);
      if (outcome === "MET") slaMet += 1;
      if (outcome === "BREACHED") slaBreached += 1;
      if (ticket.firstRespondedAt) firstResponseMinutes.push(minutesBetween(ticket.createdAt, ticket.firstRespondedAt));
    }

    return {
      agentId,
      agentName,
      assigned: assignedCohort.length,
      resolved,
      open,
      slaMet,
      slaBreached,
      slaMetPct: compliancePct(slaMet, slaBreached),
      averageFirstResponseMinutes: average(firstResponseMinutes),
    };
  });

  rows.sort((a, b) => b.assigned - a.assigned || b.resolved - a.resolved || a.agentName.localeCompare(b.agentName));

  return { ...rangeMeta(range), agents: rows, generatedAt: now.toISOString() };
}

export async function getSlaReports(range: ReportsRange, now = new Date()) {
  const tickets = await loadTickets(range);
  const cohort = tickets.filter((ticket) => createdInRange(ticket, range));

  const firstResponse = tally(cohort.map((ticket) => firstResponseOutcome(ticket, now)));
  const resolution = tally(cohort.map((ticket) => resolutionOutcome(ticket, now)));

  const byPriority = PRIORITIES.map((priority) => {
    const priorityCohort = cohort.filter((ticket) => ticket.priority === priority);
    const fr = tally(priorityCohort.map((ticket) => firstResponseOutcome(ticket, now)));
    const res = tally(priorityCohort.map((ticket) => resolutionOutcome(ticket, now)));
    return {
      priority,
      firstResponseMet: fr.met,
      firstResponseBreached: fr.breached,
      resolutionMet: res.met,
      resolutionBreached: res.breached,
      compliancePct: compliancePct(fr.met, fr.breached),
    };
  });

  const firstResponseMinutes = cohort
    .filter((ticket) => ticket.firstRespondedAt)
    .map((ticket) => minutesBetween(ticket.createdAt, ticket.firstRespondedAt as Date));
  const resolutionMinutes = cohort
    .filter((ticket) => ticket.resolvedAt)
    .map((ticket) => minutesBetween(ticket.createdAt, ticket.resolvedAt as Date));

  return {
    ...rangeMeta(range),
    firstResponse,
    resolution,
    byPriority,
    averageFirstResponseMinutes: average(firstResponseMinutes),
    averageResolutionMinutes: average(resolutionMinutes),
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Small shared shapers
// ---------------------------------------------------------------------------

function distributionByStatus(tickets: ReportTicket[]) {
  const counts = new Map<TicketStatus, number>();
  for (const ticket of tickets) counts.set(ticket.status, (counts.get(ticket.status) ?? 0) + 1);
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => a.status.localeCompare(b.status));
}

function tally(outcomes: SlaOutcome[]) {
  const met = outcomes.filter((outcome) => outcome === "MET").length;
  const breached = outcomes.filter((outcome) => outcome === "BREACHED").length;
  const pending = outcomes.filter((outcome) => outcome === "PENDING").length;
  return { met, breached, pending, total: met + breached + pending, compliancePct: compliancePct(met, breached) };
}
