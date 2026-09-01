import { Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { deriveSla } from "../../shared/sla/derive-sla.js";
import { slaFilterWhere } from "../../shared/sla/sla-filter.js";
import {
  average,
  compliancePct,
  firstResponseOutcome,
  minutesBetween,
} from "../../shared/sla/sla-outcomes.js";
import type { TicketActor } from "../tickets/ticket-visibility.js";
import {
  resolveActorTeamId,
  teamScopedAgentWhere,
  teamScopedTicketWhere,
} from "../../shared/team/team-scope.js";
import type { ManagerTeamQuery, TeamSortField } from "./manager.schema.js";

/**
 * AUTHORIZATION SCOPE (feature/team-based-manager-scope).
 *
 *   ADMIN   → organization-wide
 *   MANAGER → their own Team only (Team.managerId === userId)
 *
 * Every ticket/agent query below is routed through `shared/team/team-scope.ts`.
 * The actor's team id is resolved ONCE per request and threaded into the pure
 * `where`-builders — do not add role checks inline here.
 */
function visibilityFor(actor: TicketActor): "TEAM" | "ORGANIZATION_WIDE" {
  return actor.role === Role.MANAGER ? "TEAM" : "ORGANIZATION_WIDE";
}

const ACTIVE_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;

/** Trailing window for Manager KPI / agent-performance aggregates. */
const PERFORMANCE_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const summarySelect = {
  id: true,
  subject: true,
  status: true,
  priority: true,
  updatedAt: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
  customer: { select: { id: true, name: true } },
  assignedAgent: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

type SummaryRecord = Prisma.TicketGetPayload<{ select: typeof summarySelect }>;

const perfSelect = {
  createdAt: true,
  firstResponseDueAt: true,
  firstRespondedAt: true,
  resolutionDueAt: true,
  resolvedAt: true,
  closedAt: true,
} satisfies Prisma.TicketSelect;

type PerfRecord = Prisma.TicketGetPayload<{ select: typeof perfSelect }>;

function serialize(ticket: SummaryRecord, now: Date) {
  const sla = deriveSla(ticket, now);
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    updatedAt: ticket.updatedAt.toISOString(),
    effectiveSlaDueAt: sla.effectiveSlaDueAt,
    slaState: sla.slaState,
    customer: ticket.customer,
    assignedAgent: ticket.assignedAgent,
  };
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** `{ met, breached, avgFirstResponseMinutes, avgResolutionMinutes, resolvedCount }` over a cohort. */
function summarizePerformance(tickets: PerfRecord[], windowStart: Date, now: Date) {
  const firstResponseMinutes: number[] = [];
  const resolutionMinutes: number[] = [];
  let met = 0;
  let breached = 0;
  let resolvedCount = 0;
  for (const ticket of tickets) {
    const outcome = firstResponseOutcome(ticket, now);
    if (outcome === "MET") met += 1;
    if (outcome === "BREACHED") breached += 1;
    if (ticket.firstRespondedAt) {
      firstResponseMinutes.push(minutesBetween(ticket.createdAt, ticket.firstRespondedAt));
    }
    const completedAt = ticket.resolvedAt ?? ticket.closedAt;
    if (completedAt && completedAt.getTime() >= windowStart.getTime()) {
      resolvedCount += 1;
      resolutionMinutes.push(minutesBetween(ticket.createdAt, completedAt));
    }
  }
  return {
    slaCompliancePct: compliancePct(met, breached),
    avgFirstResponseMinutes: average(firstResponseMinutes),
    avgResolutionMinutes: average(resolutionMinutes),
    resolvedCount,
  };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getManagerOverview(actor: TicketActor, now = new Date()) {
  const teamId = await resolveActorTeamId(actor);
  const scope = teamScopedTicketWhere(actor, teamId);
  const active: Prisma.TicketWhereInput = { ...scope, status: { in: [...ACTIVE_STATUSES] } };
  const todayStart = utcDayStart(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const windowStart = new Date(todayStart.getTime() - (PERFORMANCE_WINDOW_DAYS - 1) * DAY_MS);
  const breachedWhere = slaFilterWhere("breached", now);
  const atRiskWhere = slaFilterWhere("at_risk", now);

  const [
    slaBreached,
    slaAtRisk,
    escalated,
    unassignedUrgent,
    openTickets,
    unassigned,
    resolvedToday,
    perfTickets,
    agents,
    activeByAgent,
    resolvedTodayByAgent,
    activeAssignedRows,
    priorityRows,
  ] = await Promise.all([
    prisma.ticket.count({ where: { AND: [scope, breachedWhere] } }),
    prisma.ticket.count({ where: { AND: [scope, atRiskWhere] } }),
    prisma.ticket.count({ where: { ...scope, status: TicketStatus.ESCALATED } }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: null, priority: TicketPriority.URGENT } }),
    prisma.ticket.count({ where: active }),
    prisma.ticket.count({ where: { ...active, assignedAgentId: null } }),
    prisma.ticket.count({ where: { ...scope, resolvedAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.ticket.findMany({
      where: {
        ...scope,
        OR: [
          { createdAt: { gte: windowStart, lte: now } },
          { resolvedAt: { gte: windowStart, lte: now } },
        ],
      },
      select: perfSelect,
    }),
    prisma.user.findMany({ where: teamScopedAgentWhere(actor, teamId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ticket.groupBy({
      by: ["assignedAgentId", "status"],
      where: { ...scope, assignedAgentId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["assignedAgentId"],
      where: { ...scope, assignedAgentId: { not: null }, resolvedAt: { gte: todayStart, lt: tomorrowStart } },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { ...active, assignedAgentId: { not: null } },
      select: { assignedAgentId: true, status: true, firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true, resolvedAt: true, closedAt: true },
    }),
    prisma.ticket.findMany({
      where: {
        ...active,
        OR: [{ status: TicketStatus.ESCALATED }, { priority: TicketPriority.URGENT }, breachedWhere],
      },
      select: summarySelect,
      take: 10,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const perfCohort = perfTickets.filter(
    (ticket) => ticket.createdAt.getTime() >= windowStart.getTime() && ticket.createdAt.getTime() <= now.getTime(),
  );
  const perf = summarizePerformance(perfCohort, windowStart, now);

  const teamWorkload = buildTeamWorkload(agents, activeByAgent, resolvedTodayByAgent, activeAssignedRows, now);

  return {
    meta: { visibility: visibilityFor(actor) },
    needsAttention: [
      { key: "slaBreached", count: slaBreached, ticketFilter: "sla=breached" },
      { key: "slaAtRisk", count: slaAtRisk, ticketFilter: "sla=at_risk" },
      { key: "escalated", count: escalated, ticketFilter: "status=ESCALATED" },
      { key: "unassignedUrgent", count: unassignedUrgent, ticketFilter: "assignee=unassigned&priority=URGENT" },
    ],
    kpis: {
      openTickets,
      unassigned,
      resolvedToday,
      slaCompliancePct: perf.slaCompliancePct,
      avgFirstResponseMinutes: perf.avgFirstResponseMinutes,
      avgResolutionMinutes: perf.avgResolutionMinutes,
    },
    teamWorkload,
    priorityWork: priorityRows.map((ticket) => serialize(ticket, now)),
    generatedAt: now.toISOString(),
  };
}

type StatusGroup = { assignedAgentId: string | null; status: TicketStatus; _count: { _all: number } };
type AgentGroup = { assignedAgentId: string | null; _count: { _all: number } };
type SlaRow = {
  assignedAgentId: string | null;
  status: TicketStatus;
  firstResponseDueAt: Date | null;
  firstRespondedAt: Date | null;
  resolutionDueAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
};

function buildTeamWorkload(
  agents: Array<{ id: string; name: string }>,
  activeByAgent: StatusGroup[],
  resolvedTodayByAgent: AgentGroup[],
  activeAssignedRows: SlaRow[],
  now: Date,
) {
  const openAssigned = new Map<string, number>();
  const inProgress = new Map<string, number>();
  const waitingCustomer = new Map<string, number>();
  for (const row of activeByAgent) {
    if (!row.assignedAgentId) continue;
    openAssigned.set(row.assignedAgentId, (openAssigned.get(row.assignedAgentId) ?? 0) + row._count._all);
    if (row.status === TicketStatus.IN_PROGRESS) {
      inProgress.set(row.assignedAgentId, (inProgress.get(row.assignedAgentId) ?? 0) + row._count._all);
    }
    if (row.status === TicketStatus.WAITING_CUSTOMER) {
      waitingCustomer.set(row.assignedAgentId, (waitingCustomer.get(row.assignedAgentId) ?? 0) + row._count._all);
    }
  }

  const resolvedToday = new Map<string, number>();
  for (const row of resolvedTodayByAgent) {
    if (row.assignedAgentId) resolvedToday.set(row.assignedAgentId, row._count._all);
  }

  const atRisk = new Map<string, number>();
  for (const row of activeAssignedRows) {
    if (!row.assignedAgentId) continue;
    const state = deriveSla(row, now).slaState;
    if (state === "AT_RISK" || state === "BREACHED") {
      atRisk.set(row.assignedAgentId, (atRisk.get(row.assignedAgentId) ?? 0) + 1);
    }
  }

  return agents
    .map((agent) => ({
      agentId: agent.id,
      agentName: agent.name,
      openAssigned: openAssigned.get(agent.id) ?? 0,
      inProgress: inProgress.get(agent.id) ?? 0,
      waitingCustomer: waitingCustomer.get(agent.id) ?? 0,
      atRisk: atRisk.get(agent.id) ?? 0,
      resolvedToday: resolvedToday.get(agent.id) ?? 0,
    }))
    .sort((a, b) => b.openAssigned - a.openAssigned || a.agentName.localeCompare(b.agentName));
}

// ---------------------------------------------------------------------------
// Team table
// ---------------------------------------------------------------------------

export async function getManagerTeam(actor: TicketActor, query: ManagerTeamQuery, now = new Date()) {
  const teamId = await resolveActorTeamId(actor);
  const scope = teamScopedTicketWhere(actor, teamId);
  const todayStart = utcDayStart(now);
  const windowStart = new Date(todayStart.getTime() - (PERFORMANCE_WINDOW_DAYS - 1) * DAY_MS);

  const [agents, activeByAgent, activeAssignedRows, perfTickets] = await Promise.all([
    prisma.user.findMany({ where: teamScopedAgentWhere(actor, teamId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.ticket.groupBy({
      by: ["assignedAgentId", "status"],
      where: { ...scope, assignedAgentId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
    prisma.ticket.findMany({
      where: { ...scope, assignedAgentId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
      select: { assignedAgentId: true, status: true, firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true, resolvedAt: true, closedAt: true },
    }),
    prisma.ticket.findMany({
      where: {
        ...scope,
        assignedAgentId: { not: null },
        OR: [
          { createdAt: { gte: windowStart, lte: now } },
          { resolvedAt: { gte: windowStart, lte: now } },
        ],
      },
      select: { assignedAgentId: true, ...perfSelect },
    }),
  ]);

  const workload = buildTeamWorkload(agents, activeByAgent, [], activeAssignedRows, now);
  const workloadByAgent = new Map(workload.map((row) => [row.agentId, row]));

  const perfByAgent = new Map<string, PerfRecord[]>();
  for (const row of perfTickets) {
    if (!row.assignedAgentId) continue;
    const list = perfByAgent.get(row.assignedAgentId) ?? [];
    list.push(row);
    perfByAgent.set(row.assignedAgentId, list);
  }

  let rows = agents.map((agent) => {
    const load = workloadByAgent.get(agent.id);
    const cohort = (perfByAgent.get(agent.id) ?? []).filter(
      (ticket) => ticket.createdAt.getTime() >= windowStart.getTime() && ticket.createdAt.getTime() <= now.getTime(),
    );
    const perf = summarizePerformance(cohort, windowStart, now);
    return {
      agentId: agent.id,
      agentName: agent.name,
      openAssigned: load?.openAssigned ?? 0,
      inProgress: load?.inProgress ?? 0,
      waitingCustomer: load?.waitingCustomer ?? 0,
      atRisk: load?.atRisk ?? 0,
      resolved: perf.resolvedCount,
      slaCompliancePct: perf.slaCompliancePct,
      avgFirstResponseMinutes: perf.avgFirstResponseMinutes,
      avgResolutionMinutes: perf.avgResolutionMinutes,
    };
  });

  if (query.search) {
    const needle = query.search.toLowerCase();
    rows = rows.filter((row) => row.agentName.toLowerCase().includes(needle));
  }

  rows.sort(comparator(query.sortBy, query.sortOrder));

  const total = rows.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / query.limit);
  const startIndex = (query.page - 1) * query.limit;

  return {
    meta: { visibility: visibilityFor(actor) },
    data: rows.slice(startIndex, startIndex + query.limit),
    pagination: { page: query.page, limit: query.limit, total, totalPages },
    generatedAt: now.toISOString(),
  };
}

type TeamRow = {
  agentName: string;
  openAssigned: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  slaCompliancePct: number | null;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
};

function comparator(sortBy: TeamSortField | undefined, sortOrder: "asc" | "desc") {
  const dir = sortOrder === "asc" ? 1 : -1;
  const nullsLast = (value: number | null) => (value == null ? (dir === 1 ? Infinity : -Infinity) : value);
  return (a: TeamRow, b: TeamRow): number => {
    let diff = 0;
    switch (sortBy) {
      case "name":
        diff = a.agentName.localeCompare(b.agentName);
        break;
      case "inProgress":
        diff = a.inProgress - b.inProgress;
        break;
      case "waitingCustomer":
        diff = a.waitingCustomer - b.waitingCustomer;
        break;
      case "resolved":
        diff = a.resolved - b.resolved;
        break;
      case "slaCompliance":
        diff = nullsLast(a.slaCompliancePct) - nullsLast(b.slaCompliancePct);
        break;
      case "avgFirstResponse":
        diff = nullsLast(a.avgFirstResponseMinutes) - nullsLast(b.avgFirstResponseMinutes);
        break;
      case "avgResolution":
        diff = nullsLast(a.avgResolutionMinutes) - nullsLast(b.avgResolutionMinutes);
        break;
      case "openAssigned":
      default:
        diff = a.openAssigned - b.openAssigned;
        break;
    }
    if (diff !== 0) return diff * dir;
    return a.agentName.localeCompare(b.agentName);
  };
}

// ---------------------------------------------------------------------------
// Agent detail
// ---------------------------------------------------------------------------

export async function getManagerAgentDetail(actor: TicketActor, agentId: string, now = new Date()) {
  const teamId = await resolveActorTeamId(actor);
  const agentRow = await prisma.user.findFirst({
    where: { id: agentId, role: Role.AGENT },
    select: { id: true, name: true, email: true, teamId: true },
  });
  if (!agentRow) return null;
  // A MANAGER may only inspect an agent on their own team (404, never 403 — do
  // not leak another team's roster).
  if (actor.role === Role.MANAGER && (!teamId || agentRow.teamId !== teamId)) return null;
  const agent = { id: agentRow.id, name: agentRow.name, email: agentRow.email };

  const scope = teamScopedTicketWhere(actor, teamId);
  const assigned: Prisma.TicketWhereInput = { ...scope, assignedAgentId: agentId };
  const active: Prisma.TicketWhereInput = { ...assigned, status: { in: [...ACTIVE_STATUSES] } };
  const todayStart = utcDayStart(now);
  const windowStart = new Date(todayStart.getTime() - (PERFORMANCE_WINDOW_DAYS - 1) * DAY_MS);
  const breachedWhere = slaFilterWhere("breached", now);
  const atRiskWhere = slaFilterWhere("at_risk", now);

  const [
    byStatus,
    slaBreached,
    slaAtRisk,
    perfTickets,
    feedback,
    atRiskTickets,
    recentTickets,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: active, _count: { _all: true } }),
    prisma.ticket.count({ where: { AND: [assigned, breachedWhere] } }),
    prisma.ticket.count({ where: { AND: [assigned, atRiskWhere] } }),
    prisma.ticket.findMany({
      where: {
        ...assigned,
        OR: [
          { createdAt: { gte: windowStart, lte: now } },
          { resolvedAt: { gte: windowStart, lte: now } },
        ],
      },
      select: perfSelect,
    }),
    prisma.feedback.findMany({
      where: { ticket: { assignedAgentId: agentId }, createdAt: { gte: windowStart, lte: now } },
      select: { rating: true },
    }),
    prisma.ticket.findMany({
      where: { AND: [active, { OR: [breachedWhere, atRiskWhere] }] },
      select: summarySelect,
      take: 8,
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    }),
    prisma.ticket.findMany({
      where: assigned,
      select: summarySelect,
      take: 8,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }),
  ]);

  const statusCount = (status: TicketStatus) =>
    byStatus.find((row) => row.status === status)?._count._all ?? 0;

  const perfCohort = perfTickets.filter(
    (ticket) => ticket.createdAt.getTime() >= windowStart.getTime() && ticket.createdAt.getTime() <= now.getTime(),
  );
  const perf = summarizePerformance(perfCohort, windowStart, now);
  const ratings = feedback.map((entry) => entry.rating);
  const averageRating = ratings.length
    ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 100) / 100
    : null;

  return {
    meta: { visibility: visibilityFor(actor) },
    agent,
    workload: {
      openAssigned: [...ACTIVE_STATUSES].reduce((sum, status) => sum + statusCount(status), 0),
      inProgress: statusCount(TicketStatus.IN_PROGRESS),
      waitingCustomer: statusCount(TicketStatus.WAITING_CUSTOMER),
      escalated: statusCount(TicketStatus.ESCALATED),
    },
    slaRisk: { breached: slaBreached, atRisk: slaAtRisk },
    performance: {
      windowDays: PERFORMANCE_WINDOW_DAYS,
      avgFirstResponseMinutes: perf.avgFirstResponseMinutes,
      avgResolutionMinutes: perf.avgResolutionMinutes,
      resolvedCount: perf.resolvedCount,
      slaCompliancePct: perf.slaCompliancePct,
      csat: { averageRating, responseCount: ratings.length },
    },
    atRiskTickets: atRiskTickets.map((ticket) => serialize(ticket, now)),
    recentTickets: recentTickets.map((ticket) => serialize(ticket, now)),
    generatedAt: now.toISOString(),
  };
}
