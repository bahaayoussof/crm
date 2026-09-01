import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  feedbackFindMany: vi.fn(),
  userFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ticket: { findMany: mocks.ticketFindMany },
    feedback: { findMany: mocks.feedbackFindMany },
    user: { findMany: mocks.userFindMany },
    category: { findMany: mocks.categoryFindMany },
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { getAgentReports, getReportsOverview, getSlaReports, getTicketReports } from "./reports.service.js";

const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });

const range = { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-08-31T23:59:59.999Z") };
const now = new Date("2026-08-27T12:00:00.000Z");

const d = (iso: string) => new Date(iso);
const ticket = (overrides: Partial<Record<string, unknown>>) => ({
  id: "t", status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, categoryId: "c1", assignedAgentId: "a1",
  createdAt: d("2026-08-10T00:00:00.000Z"),
  firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null, closedAt: null,
  ...overrides,
});

const t1 = ticket({ id: "t1", status: TicketStatus.RESOLVED, priority: TicketPriority.MEDIUM, assignedAgentId: "a1", categoryId: "c1",
  createdAt: d("2026-08-05T00:00:00.000Z"), firstResponseDueAt: d("2026-08-05T01:00:00.000Z"), firstRespondedAt: d("2026-08-05T00:30:00.000Z"),
  resolutionDueAt: d("2026-08-06T00:00:00.000Z"), resolvedAt: d("2026-08-05T20:00:00.000Z") });
const t2 = ticket({ id: "t2", status: TicketStatus.OPEN, priority: TicketPriority.HIGH, assignedAgentId: "a1", categoryId: "c1",
  createdAt: d("2026-08-10T00:00:00.000Z"), firstResponseDueAt: d("2026-08-10T01:00:00.000Z"), firstRespondedAt: d("2026-08-10T02:00:00.000Z"),
  resolutionDueAt: d("2026-08-11T00:00:00.000Z") });
const t3 = ticket({ id: "t3", status: TicketStatus.IN_PROGRESS, priority: TicketPriority.LOW, assignedAgentId: "a2", categoryId: null,
  createdAt: d("2026-08-20T00:00:00.000Z"), firstResponseDueAt: d("2026-08-27T18:00:00.000Z"),
  resolutionDueAt: d("2026-08-28T00:00:00.000Z") });
const t4 = ticket({ id: "t4", status: TicketStatus.CLOSED, priority: TicketPriority.URGENT, assignedAgentId: "a2", categoryId: "c1",
  createdAt: d("2026-07-25T00:00:00.000Z"), firstResponseDueAt: d("2026-07-25T01:00:00.000Z"), firstRespondedAt: d("2026-07-25T00:10:00.000Z"),
  resolutionDueAt: d("2026-07-27T00:00:00.000Z"), resolvedAt: d("2026-08-03T00:00:00.000Z"), closedAt: d("2026-08-03T00:00:00.000Z") });

const fixtureTickets = [t4, t1, t2, t3];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ticketFindMany.mockResolvedValue(fixtureTickets);
  mocks.feedbackFindMany.mockResolvedValue([{ rating: 5 }, { rating: 4 }, { rating: 4 }, { rating: 2 }]);
  mocks.userFindMany.mockResolvedValue([{ id: "a1", name: "Alice" }, { id: "a2", name: "Bob" }]);
  mocks.categoryFindMany.mockResolvedValue([{ id: "c1", name: "Billing" }]);
});

describe("reports authorization", () => {
  const routes = ["/api/reports/overview", "/api/reports/tickets", "/api/reports/agents", "/api/reports/sla"];

  it("rejects unauthenticated, CUSTOMER, and AGENT callers on every route", async () => {
    for (const route of routes) {
      expect((await request(app).get(route)).status).toBe(401);
      expect((await request(app).get(route).set(auth("c1", Role.CUSTOMER))).status).toBe(403);
      expect((await request(app).get(route).set(auth("ag1", Role.AGENT))).status).toBe(403);
    }
  });

  it.each([Role.ADMIN, Role.MANAGER])("allows %s on every route", async (role) => {
    for (const route of routes) {
      expect((await request(app).get(route).set(auth("staff", role))).status).toBe(200);
    }
  });
});

describe("reports range validation", () => {
  it("defaults to the trailing 30 days ending now when no params are given", async () => {
    await request(app).get("/api/reports/overview").set(auth("staff", Role.ADMIN));
    const where = mocks.ticketFindMany.mock.calls[0][0].where;
    const gte = new Date(where.OR[0].createdAt.gte).getTime();
    const lte = new Date(where.OR[0].createdAt.lte).getTime();
    expect(lte - gte).toBeCloseTo(30 * 86_400_000, -4);
    expect(Math.abs(Date.now() - lte)).toBeLessThan(10_000);
  });

  it("passes an explicit range through to the query", async () => {
    await request(app)
      .get("/api/reports/sla?from=2026-08-01T00:00:00.000Z&to=2026-08-10T00:00:00.000Z")
      .set(auth("staff", Role.MANAGER));
    const createdAt = mocks.ticketFindMany.mock.calls[0][0].where.OR[0].createdAt;
    expect(createdAt).toEqual({ gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-10T00:00:00.000Z") });
  });

  it("rejects from after to and ranges longer than 366 days", async () => {
    expect((await request(app).get("/api/reports/overview?from=2026-08-31&to=2026-08-01").set(auth("s", Role.ADMIN))).status).toBe(400);
    expect((await request(app).get("/api/reports/overview?from=2020-01-01&to=2026-01-01").set(auth("s", Role.ADMIN))).status).toBe(400);
    expect((await request(app).get("/api/reports/overview?bogus=1").set(auth("s", Role.ADMIN))).status).toBe(400);
  });
});

describe("reports overview", () => {
  it("computes KPIs, SLA compliance, and satisfaction from real rows", async () => {
    const result = await getReportsOverview(range, now);
    expect(result.timezone).toBe("UTC");
    expect(result.kpis.createdTickets).toBe(3);
    expect(result.kpis.resolvedTickets).toBe(2);
    expect(result.kpis.slaCompliancePct).toBe(50);
    expect(result.kpis.averageFirstResponseMinutes).toBe(75);
    expect(result.kpis.satisfaction).toEqual({ averageRating: 3.75, responseCount: 4 });
    expect(result.satisfaction.distribution).toEqual([
      { rating: 1, count: 0 }, { rating: 2, count: 1 }, { rating: 3, count: 0 }, { rating: 4, count: 2 }, { rating: 5, count: 1 },
    ]);
    expect(result.statusDistribution).toEqual([
      { status: "IN_PROGRESS", count: 1 }, { status: "OPEN", count: 1 }, { status: "RESOLVED", count: 1 },
    ]);
  });

  it("emits one ticket-volume bucket per UTC day across the range", async () => {
    const result = await getReportsOverview(range, now);
    expect(result.ticketVolume).toHaveLength(31);
    expect(result.ticketVolume[0]).toEqual({ date: "2026-08-01", created: 0, resolved: 0 });
    expect(result.ticketVolume.find((bucket) => bucket.date === "2026-08-05")).toEqual({ date: "2026-08-05", created: 1, resolved: 1 });
    expect(result.ticketVolume.find((bucket) => bucket.date === "2026-08-03")?.resolved).toBe(1);
  });

  it("returns null satisfaction when there is no feedback", async () => {
    mocks.feedbackFindMany.mockResolvedValueOnce([]);
    const result = await getReportsOverview(range, now);
    expect(result.kpis.satisfaction).toEqual({ averageRating: null, responseCount: 0 });
  });
});

describe("reports tickets", () => {
  it("breaks volume down by priority, category, and channel for the created cohort", async () => {
    const result = await getTicketReports(range, now);
    expect(result.totals).toEqual({ created: 3, resolved: 2, open: 2 });
    expect(result.byPriority).toEqual([
      { priority: "LOW", created: 1, resolved: 0 },
      { priority: "MEDIUM", created: 1, resolved: 1 },
      { priority: "HIGH", created: 1, resolved: 0 },
      { priority: "URGENT", created: 0, resolved: 1 },
    ]);
    expect(result.byCategory).toEqual([
      { categoryId: "c1", categoryName: "Billing", created: 2, resolved: 2 },
      { categoryId: null, categoryName: null, created: 1, resolved: 0 },
    ]);
    expect(Array.isArray(result.byChannel)).toBe(true);
  });
});

describe("reports agents", () => {
  it("aggregates assigned, resolved, open, and SLA figures per agent with pagination", async () => {
    const result = await getAgentReports(range, now);
    expect(result.agents).toEqual([
      { agentId: "a1", agentName: "Alice", assigned: 2, resolved: 1, open: 1, slaMet: 1, slaBreached: 1, slaMetPct: 50, averageFirstResponseMinutes: 75 },
      { agentId: "a2", agentName: "Bob", assigned: 1, resolved: 1, open: 1, slaMet: 0, slaBreached: 0, slaMetPct: null, averageFirstResponseMinutes: null },
    ]);
    expect(result.pagination).toEqual({ page: 1, limit: 15, total: 2, totalPages: 1 });
  });

  it("filters agents by search query", async () => {
    const result = await getAgentReports({ ...range, search: "alice", page: 1, limit: 15, sortOrder: "desc" }, now);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agentName).toBe("Alice");
    expect(result.pagination.total).toBe(1);
  });

  it("sorts agents deterministically by supported fields", async () => {
    const byNameAsc = await getAgentReports({ ...range, sortBy: "name", sortOrder: "asc", page: 1, limit: 15 }, now);
    expect(byNameAsc.agents.map((a) => a.agentName)).toEqual(["Alice", "Bob"]);

    const byNameDesc = await getAgentReports({ ...range, sortBy: "name", sortOrder: "desc", page: 1, limit: 15 }, now);
    expect(byNameDesc.agents.map((a) => a.agentName)).toEqual(["Bob", "Alice"]);

    const byResolvedDesc = await getAgentReports({ ...range, sortBy: "resolved", sortOrder: "desc", page: 1, limit: 15 }, now);
    // Both Alice and Bob have resolved=1 -> secondary sort is name asc -> Alice, Bob
    expect(byResolvedDesc.agents.map((a) => a.agentName)).toEqual(["Alice", "Bob"]);
  });

  it("paginates agent results correctly", async () => {
    const page1 = await getAgentReports({ ...range, page: 1, limit: 1, sortOrder: "desc" }, now);
    expect(page1.agents).toHaveLength(1);
    expect(page1.agents[0].agentName).toBe("Alice");
    expect(page1.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });

    const page2 = await getAgentReports({ ...range, page: 2, limit: 1, sortOrder: "desc" }, now);
    expect(page2.agents).toHaveLength(1);
    expect(page2.agents[0].agentName).toBe("Bob");
    expect(page2.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it("rejects invalid sortBy values via API", async () => {
    const res = await request(app)
      .get("/api/reports/agents?sortBy=invalidColumn")
      .set(auth("staff", Role.ADMIN));
    expect(res.status).toBe(400);
  });
});

describe("reports sla", () => {
  it("tallies first-response and resolution outcomes for the cohort", async () => {
    const result = await getSlaReports(range, now);
    expect(result.firstResponse).toEqual({ met: 1, breached: 1, pending: 1, total: 3, compliancePct: 50 });
    expect(result.resolution).toEqual({ met: 1, breached: 1, pending: 1, total: 3, compliancePct: 50 });
    expect(result.averageFirstResponseMinutes).toBe(75);
    expect(result.byPriority.find((row) => row.priority === "HIGH")).toEqual({
      priority: "HIGH", firstResponseMet: 0, firstResponseBreached: 1, resolutionMet: 0, resolutionBreached: 1, compliancePct: 0,
    });
  });
});

