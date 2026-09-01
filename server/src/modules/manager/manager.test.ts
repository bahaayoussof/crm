import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketCount: vi.fn(),
  ticketFindMany: vi.fn(),
  ticketGroupBy: vi.fn(),
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  feedbackFindMany: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ticket: { count: mocks.ticketCount, findMany: mocks.ticketFindMany, groupBy: mocks.ticketGroupBy },
    user: { findMany: mocks.userFindMany, findFirst: mocks.userFindFirst, findUnique: mocks.userFindUnique },
    feedback: { findMany: mocks.feedbackFindMany },
    $transaction: vi.fn(),
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { getManagerAgentDetail, getManagerOverview, getManagerTeam } from "./manager.service.js";

const now = new Date("2026-09-01T12:00:00.000Z");
const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });
const AGENT_ID = "c6ff3b3bd11c44cac620c43d5";
const MANAGER = { userId: "mgr00000000000000000000001", role: Role.MANAGER } as const;
const MGR_TEAM = "cmgrteammgrteammgrteam0001";

const summaryTicket = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  subject: "Payment failed",
  status: TicketStatus.ESCALATED,
  priority: TicketPriority.URGENT,
  updatedAt: new Date("2026-09-01T09:00:00.000Z"),
  firstResponseDueAt: null,
  firstRespondedAt: null,
  resolutionDueAt: null,
  resolvedAt: null,
  closedAt: null,
  customer: { id: "c1", name: "Ahmed" },
  assignedAgent: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ticketCount.mockResolvedValue(0);
  mocks.ticketFindMany.mockResolvedValue([]);
  mocks.ticketGroupBy.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userFindFirst.mockResolvedValue({ id: AGENT_ID, name: "Sara", email: "sara@example.com", teamId: MGR_TEAM });
  // feature/team-based-manager-scope: resolveActorTeamId() -> user.findUnique
  mocks.userFindUnique.mockResolvedValue({ teamId: MGR_TEAM, managedTeam: { id: MGR_TEAM } });
  mocks.feedbackFindMany.mockResolvedValue([]);
});

describe("manager console authorization", () => {
  const routes = ["/api/manager/overview", "/api/manager/team", `/api/manager/team/${AGENT_ID}`];

  it("rejects unauthenticated, CUSTOMER, and AGENT callers on every route", async () => {
    for (const route of routes) {
      expect((await request(app).get(route)).status).toBe(401);
      expect((await request(app).get(route).set(auth("cust00000000000000000000001", Role.CUSTOMER))).status).toBe(403);
      expect((await request(app).get(route).set(auth(AGENT_ID, Role.AGENT))).status).toBe(403);
    }
  });

  it.each([Role.ADMIN, Role.MANAGER])("allows %s on every route", async (role) => {
    for (const route of routes) {
      const response = await request(app).get(route).set(auth("staff00000000000000000001x", role));
      expect(response.status).toBe(200);
    }
  });
});

describe("getManagerOverview", () => {
  it("returns TEAM visibility, actionable needs-attention items, KPIs and team workload", async () => {
    mocks.ticketCount
      .mockResolvedValueOnce(2) // slaBreached
      .mockResolvedValueOnce(3) // slaAtRisk
      .mockResolvedValueOnce(1) // escalated
      .mockResolvedValueOnce(4) // unassignedUrgent
      .mockResolvedValueOnce(20) // openTickets
      .mockResolvedValueOnce(5) // unassigned
      .mockResolvedValueOnce(7); // resolvedToday
    mocks.ticketFindMany
      .mockResolvedValueOnce([]) // perf cohort
      .mockResolvedValueOnce([]) // active assigned rows (atRisk)
      .mockResolvedValueOnce([summaryTicket()]); // priority work
    mocks.ticketGroupBy
      .mockResolvedValueOnce([
        { assignedAgentId: "a1", status: TicketStatus.OPEN, _count: { _all: 3 } },
        { assignedAgentId: "a1", status: TicketStatus.IN_PROGRESS, _count: { _all: 2 } },
        { assignedAgentId: "a2", status: TicketStatus.WAITING_CUSTOMER, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ assignedAgentId: "a1", _count: { _all: 4 } }]);
    mocks.userFindMany.mockResolvedValueOnce([
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Bob" },
    ]);

    const data = await getManagerOverview(MANAGER, now);

    expect(data.meta.visibility).toBe("TEAM");
    // every ticket query is scoped to the manager's own team
    expect(mocks.ticketCount.mock.calls.every((c) => JSON.stringify(c[0]).includes(MGR_TEAM))).toBe(true);
    expect(data.needsAttention).toEqual([
      { key: "slaBreached", count: 2, ticketFilter: "sla=breached" },
      { key: "slaAtRisk", count: 3, ticketFilter: "sla=at_risk" },
      { key: "escalated", count: 1, ticketFilter: "status=ESCALATED" },
      { key: "unassignedUrgent", count: 4, ticketFilter: "assignee=unassigned&priority=URGENT" },
    ]);
    expect(data.kpis).toMatchObject({ openTickets: 20, unassigned: 5, resolvedToday: 7 });
    expect(data.teamWorkload).toEqual([
      { agentId: "a1", agentName: "Alice", openAssigned: 5, inProgress: 2, waitingCustomer: 0, atRisk: 0, resolvedToday: 4 },
      { agentId: "a2", agentName: "Bob", openAssigned: 1, inProgress: 0, waitingCustomer: 1, atRisk: 0, resolvedToday: 0 },
    ]);
    expect(data.priorityWork[0]).toMatchObject({ id: "t1", slaState: expect.any(String) });
    expect(data.priorityWork[0]).not.toHaveProperty("effectiveSlaTarget");
  });

  it("does not narrow any query by department/team (no Manager ownership in the schema yet)", async () => {
    await getManagerOverview(MANAGER, now);
    for (const call of mocks.ticketCount.mock.calls) {
      expect(JSON.stringify(call[0].where)).not.toContain("departmentId");
      expect(JSON.stringify(call[0].where)).not.toContain("branchId");
    }
  });
});

describe("getManagerTeam", () => {
  const query = { page: 1, limit: 15, sortOrder: "desc" as const, sortBy: undefined, search: undefined };

  beforeEach(() => {
    mocks.userFindMany.mockResolvedValue([
      { id: "a1", name: "Alice" },
      { id: "a2", name: "Bob" },
      { id: "a3", name: "Carol" },
    ]);
    mocks.ticketGroupBy.mockResolvedValue([
      { assignedAgentId: "a1", status: TicketStatus.OPEN, _count: { _all: 3 } },
      { assignedAgentId: "a2", status: TicketStatus.OPEN, _count: { _all: 1 } },
    ]);
  });

  it("returns every agent, sorted by active load, with pagination metadata", async () => {
    const data = await getManagerTeam(MANAGER, query, now);
    expect(data.data.map((row) => row.agentName)).toEqual(["Alice", "Bob", "Carol"]);
    expect(data.data.map((row) => row.openAssigned)).toEqual([3, 1, 0]);
    expect(data.pagination).toEqual({ page: 1, limit: 15, total: 3, totalPages: 1 });
  });

  it("filters by name search", async () => {
    const data = await getManagerTeam(MANAGER, { ...query, search: "car" }, now);
    expect(data.data.map((row) => row.agentName)).toEqual(["Carol"]);
  });

  it("sorts by agent name when requested", async () => {
    const data = await getManagerTeam(MANAGER, { ...query, sortBy: "name", sortOrder: "asc" }, now);
    expect(data.data.map((row) => row.agentName)).toEqual(["Alice", "Bob", "Carol"]);
  });
});

describe("getManagerAgentDetail", () => {
  it("returns null for a non-agent id (so the route answers 404)", async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    expect(await getManagerAgentDetail(MANAGER, "adm00000000000000000000001", now)).toBeNull();
  });

  it("summarizes workload, SLA risk and 30-day performance for an agent", async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: AGENT_ID, name: "Sara", email: "sara@example.com", teamId: MGR_TEAM });
    mocks.ticketGroupBy.mockResolvedValueOnce([
      { status: TicketStatus.OPEN, _count: { _all: 2 } },
      { status: TicketStatus.IN_PROGRESS, _count: { _all: 1 } },
    ]);
    mocks.ticketCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    mocks.feedbackFindMany.mockResolvedValueOnce([{ rating: 5 }, { rating: 4 }]);

    const data = await getManagerAgentDetail(MANAGER, AGENT_ID, now);

    expect(data?.agent).toEqual({ id: AGENT_ID, name: "Sara", email: "sara@example.com" });
    expect(data?.workload).toEqual({ openAssigned: 3, inProgress: 1, waitingCustomer: 0, escalated: 0 });
    expect(data?.slaRisk).toEqual({ breached: 1, atRisk: 0 });
    expect(data?.performance).toMatchObject({ windowDays: 30, csat: { averageRating: 4.5, responseCount: 2 } });
  });

  it("404s through the route for an unknown agent", async () => {
    mocks.userFindFirst.mockResolvedValueOnce(null);
    const response = await request(app)
      .get(`/api/manager/team/${AGENT_ID}`)
      .set(auth("staff00000000000000000001x", Role.MANAGER));
    expect(response.status).toBe(404);
    expect(JSON.stringify(response.body)).toContain("AGENT_NOT_FOUND");
  });

  // feature/team-based-manager-scope — cross-team isolation
  it("404s an agent who belongs to a DIFFERENT team (no roster leak)", async () => {
    mocks.userFindFirst.mockResolvedValueOnce({ id: AGENT_ID, name: "Sara", email: "s@x.com", teamId: "cotherteamotherteamother01" });
    expect(await getManagerAgentDetail(MANAGER, AGENT_ID, now)).toBeNull();
  });

  it("404s every agent for a MANAGER with no team", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
    mocks.userFindFirst.mockResolvedValueOnce({ id: AGENT_ID, name: "Sara", email: "s@x.com", teamId: "cany" });
    expect(await getManagerAgentDetail(MANAGER, AGENT_ID, now)).toBeNull();
  });
});

describe("getManagerOverview — team scope", () => {
  it("scopes every ticket query to the manager's own team and reports TEAM visibility", async () => {
    const data = await getManagerOverview(MANAGER, now);
    expect(data.meta.visibility).toBe("TEAM");
    for (const call of mocks.ticketCount.mock.calls) {
      expect(JSON.stringify(call[0])).toContain(MGR_TEAM);
    }
    // agent roster is team-scoped too
    expect(mocks.userFindMany.mock.calls[0][0].where).toMatchObject({ role: Role.AGENT, isActive: true, teamId: MGR_TEAM });
  });

  it("matches nothing for a MANAGER with no team", async () => {
    mocks.userFindUnique.mockResolvedValue({ teamId: null, managedTeam: null });
    await getManagerOverview(MANAGER, now);
    expect(mocks.userFindMany.mock.calls[0][0].where).toMatchObject({ id: { in: [] } });
  });
});
