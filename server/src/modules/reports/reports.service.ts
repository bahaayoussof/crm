import { Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import {
  average,
  compliancePct,
  firstResponseOutcome,
  minutesBetween,
  resolutionOutcome,
  type SlaOutcome,
} from "../../shared/sla/sla-outcomes.js";
import type { ReportsAgentsQuery, ReportsRange } from "./reports.schema.js";

const DAY_MS = 86_400_000;

/** Statuses that still count as unresolved work. */
const ACTIVE_STATUSES: TicketStatus[] = [
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

const CHANNELS = ["WEB", "EMAIL", "WHATSAPP", "SMS", "LIVE_CHAT"] as const;

const reportTicketSelect = {
  id: true,
  status: true,
  priority: true,
  categoryId: true,
  channel: true,
  assignedAgentId: true,
  createdAt: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
} satisfies Prisma.TicketSelect;


type ReportTicket = Prisma.TicketGetPayload<{ select: typeof reportTicketSelect }>;

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
      // Team scope (feature/team-based-manager-scope): the controller injects the
      // MANAGER's own team id here (or a sentinel that matches nothing when the
      // manager has no team). ADMIN leaves it undefined → organization-wide.
      ...(range.teamId ? { teamId: range.teamId } : {}),
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
  const categoryCreated = new Map<string | null, number>();
  const categoryResolved = new Map<string | null, number>();
  for (const ticket of cohort) {
    categoryCreated.set(ticket.categoryId, (categoryCreated.get(ticket.categoryId) ?? 0) + 1);
  }
  for (const ticket of tickets.filter((t) => resolvedInRange(t, range))) {
    categoryResolved.set(ticket.categoryId, (categoryResolved.get(ticket.categoryId) ?? 0) + 1);
  }
  const allCategoryIds = new Set([...categoryCreated.keys(), ...categoryResolved.keys()]);
  const byCategory = [...allCategoryIds]
    .map((categoryId) => ({
      categoryId,
      categoryName: categoryId ? categoryName.get(categoryId) ?? categoryId : null,
      created: categoryCreated.get(categoryId) ?? 0,
      resolved: categoryResolved.get(categoryId) ?? 0,
    }))
    .sort((a, b) => b.created - a.created || String(a.categoryName).localeCompare(String(b.categoryName)));

  const byChannel = CHANNELS.map((channel) => ({
    channel,
    created: cohort.filter((ticket) => ticket.channel === channel).length,
    resolved: tickets.filter((ticket) => ticket.channel === channel && resolvedInRange(ticket, range)).length,
  }));

  return {
    ...rangeMeta(range),
    totals: {
      created: cohort.length,
      resolved: tickets.filter((ticket) => resolvedInRange(ticket, range)).length,
      open: cohort.filter((ticket) => ACTIVE_STATUSES.includes(ticket.status)).length,
    },
    volume: buildVolume(tickets, range),
    byStatus: statusBreakdown(cohort, tickets, range),
    byPriority,
    byCategory,
    byChannel,
    generatedAt: now.toISOString(),
  };
}

export async function getAgentReports(query: ReportsAgentsQuery | ReportsRange, now = new Date()) {
  const [tickets, agents] = await Promise.all([
    loadTickets(query),
    prisma.user.findMany({
      where: { role: Role.AGENT, ...(query.teamId ? { teamId: query.teamId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  for (const ticket of tickets) {
    if (ticket.assignedAgentId && !names.has(ticket.assignedAgentId)) names.set(ticket.assignedAgentId, ticket.assignedAgentId);
  }

  let rows = [...names.entries()].map(([agentId, agentName]) => {
    const assignedCohort = tickets.filter((ticket) => ticket.assignedAgentId === agentId && createdInRange(ticket, query));
    const resolved = tickets.filter(
      (ticket) => ticket.assignedAgentId === agentId && resolvedInRange(ticket, query),
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

  const search = "search" in query && query.search ? query.search.trim().toLowerCase() : undefined;
  if (search) {
    rows = rows.filter((row) => row.agentName.toLowerCase().includes(search));
  }

  const sortBy = "sortBy" in query ? query.sortBy : undefined;
  const sortOrder = "sortOrder" in query && query.sortOrder ? query.sortOrder : "desc";
  const multiplier = sortOrder === "asc" ? 1 : -1;

  rows.sort((a, b) => {
    if (sortBy === "name") {
      const comp = a.agentName.localeCompare(b.agentName);
      if (comp !== 0) return comp * multiplier;
    } else if (sortBy === "assigned") {
      const diff = a.assigned - b.assigned;
      if (diff !== 0) return diff * multiplier;
    } else if (sortBy === "resolved") {
      const diff = a.resolved - b.resolved;
      if (diff !== 0) return diff * multiplier;
    } else if (sortBy === "open") {
      const diff = a.open - b.open;
      if (diff !== 0) return diff * multiplier;
    } else if (sortBy === "slaMetPercentage") {
      const valA = a.slaMetPct ?? (multiplier === 1 ? Infinity : -Infinity);
      const valB = b.slaMetPct ?? (multiplier === 1 ? Infinity : -Infinity);
      const diff = valA - valB;
      if (diff !== 0) return diff * multiplier;
    } else if (sortBy === "avgFirstResponse") {
      const valA = a.averageFirstResponseMinutes ?? (multiplier === 1 ? Infinity : -Infinity);
      const valB = b.averageFirstResponseMinutes ?? (multiplier === 1 ? Infinity : -Infinity);
      const diff = valA - valB;
      if (diff !== 0) return diff * multiplier;
    } else {
      const assignedDiff = b.assigned - a.assigned;
      if (assignedDiff !== 0) return assignedDiff;
      const resolvedDiff = b.resolved - a.resolved;
      if (resolvedDiff !== 0) return resolvedDiff;
    }
    const nameDiff = a.agentName.localeCompare(b.agentName);
    if (nameDiff !== 0) return nameDiff;
    return a.agentId.localeCompare(b.agentId);
  });

  const total = rows.length;
  const page = "page" in query && query.page ? query.page : 1;
  const limit = "limit" in query && query.limit ? query.limit : 15;
  const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const paginatedRows = rows.slice(startIndex, startIndex + limit);


  return {
    ...rangeMeta(query),
    agents: paginatedRows,
    data: paginatedRows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    total,
    page,
    limit,
    totalPages,
    generatedAt: now.toISOString(),
  };
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

function statusBreakdown(cohort: ReportTicket[], tickets: ReportTicket[], range: ReportsRange) {
  const counts = new Map<TicketStatus, { created: number; resolved: number }>();
  for (const status of Object.values(TicketStatus)) {
    counts.set(status, { created: 0, resolved: 0 });
  }
  for (const ticket of cohort) {
    const curr = counts.get(ticket.status) ?? { created: 0, resolved: 0 };
    curr.created += 1;
    counts.set(ticket.status, curr);
  }
  for (const ticket of tickets.filter((t) => resolvedInRange(t, range))) {
    const curr = counts.get(ticket.status) ?? { created: 0, resolved: 0 };
    curr.resolved += 1;
    counts.set(ticket.status, curr);
  }
  return [...counts.entries()]
    .map(([status, val]) => ({
      status,
      count: val.created,
      created: val.created,
      resolved: val.resolved,
    }))
    .filter((s) => s.created > 0 || s.resolved > 0)
    .sort((a, b) => a.status.localeCompare(b.status));
}

function tally(outcomes: SlaOutcome[]) {
  const met = outcomes.filter((outcome) => outcome === "MET").length;
  const breached = outcomes.filter((outcome) => outcome === "BREACHED").length;
  const pending = outcomes.filter((outcome) => outcome === "PENDING").length;
  return { met, breached, pending, total: met + breached + pending, compliancePct: compliancePct(met, breached) };
}


