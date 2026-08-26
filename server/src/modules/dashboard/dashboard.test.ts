import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() }));
vi.mock("../../config/prisma.js", () => ({ prisma: { ticket: mocks, $transaction: vi.fn() } }));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { deriveSla } from "../../shared/sla/derive-sla.js";
import { getDashboardOverview } from "./dashboard.service.js";

const now = new Date("2026-08-25T12:00:00.000Z");
const base = { id: "t-1", subject: "Payment failed", status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, updatedAt: new Date("2026-08-25T10:00:00.000Z"), firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, resolvedAt: null, closedAt: null, customer: { id: "c-1", name: "Ahmed" }, assignedAgent: null };
const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });

describe("dashboard overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(1).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    mocks.groupBy.mockResolvedValue([{ status: TicketStatus.OPEN, _count: { _all: 5 } }]);
    mocks.findMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated and CUSTOMER access", async () => {
    expect((await request(app).get("/api/dashboard/overview")).status).toBe(401);
    expect((await request(app).get("/api/dashboard/overview").set(auth("customer-1", Role.CUSTOMER))).status).toBe(403);
  });

  it.each([Role.ADMIN, Role.MANAGER])("keeps the %s primary queue as system-wide Needs Attention", async (role) => {
    const response = await request(app).get("/api/dashboard/overview").set(auth("staff-1", role));
    expect(response.status).toBe(200); expect(response.body.data.metrics).toEqual({ openTickets: 5, assignedToMe: 2, unassignedTickets: 1, slaAtRisk: 1, slaBreached: 1, resolvedToday: 3, waitingCustomer: 1 });
    expect(response.body.data.primaryQueueType).toBe("NEEDS_ATTENTION");
    expect(mocks.count.mock.calls[0][0].where).not.toHaveProperty("OR");
  });

  it("applies assigned-or-unassigned visibility to every AGENT query", async () => {
    await request(app).get("/api/dashboard/overview").set(auth("agent-1", Role.AGENT));
    const serialized = JSON.stringify([...mocks.count.mock.calls, ...mocks.findMany.mock.calls, ...mocks.groupBy.mock.calls]);
    expect(serialized).not.toContain("agent-2");
    expect(serialized.match(/agent-1/g)?.length).toBeGreaterThan(10);
  });

  it("uses UTC day boundaries for resolved today", async () => {
    await getDashboardOverview({ userId: "admin", role: Role.ADMIN }, now);
    const where = mocks.count.mock.calls[5][0].where;
    expect(where.resolvedAt).toEqual({ gte: new Date("2026-08-25T00:00:00.000Z"), lt: new Date("2026-08-26T00:00:00.000Z") });
  });

  it("derives breached, at-risk, on-track, missing, met, and completed-response SLA states", () => {
    expect(deriveSla({ ...base, firstResponseDueAt: now }, now).slaState).toBe("BREACHED");
    expect(deriveSla({ ...base, firstResponseDueAt: new Date(now.getTime() + 60 * 60_000) }, now).slaState).toBe("AT_RISK");
    expect(deriveSla({ ...base, firstResponseDueAt: new Date(now.getTime() + 61 * 60_000) }, now).slaState).toBe("ON_TRACK");
    expect(deriveSla(base, now).slaState).toBe("NOT_CONFIGURED");
    expect(deriveSla({ ...base, status: TicketStatus.RESOLVED, resolvedAt: now }, now).slaState).toBe("MET");
    expect(deriveSla({ ...base, firstResponseDueAt: new Date(now.getTime() - 60_000), firstRespondedAt: now }, now).slaState).toBe("MET");
    expect(deriveSla({ ...base, firstResponseDueAt: new Date(now.getTime() - 60_000), firstRespondedAt: now, resolutionDueAt: new Date(now.getTime() + 2 * 60 * 60_000) }, now).slaState).toBe("ON_TRACK");
  });

  it("orders Needs Attention deterministically and returns only safe fields", async () => {
    const breached = { ...base, id: "b", firstResponseDueAt: new Date(now.getTime() - 1), assignedAgent: { id: "a", name: "Agent" } };
    const urgent = { ...base, id: "u", priority: TicketPriority.URGENT };
    const highA = { ...base, id: "a", priority: TicketPriority.HIGH };
    const highZ = { ...base, id: "z", priority: TicketPriority.HIGH };
    mocks.findMany.mockReset().mockResolvedValueOnce([breached]).mockResolvedValueOnce([]).mockResolvedValueOnce([urgent]).mockResolvedValueOnce([highZ, highA]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const data = await getDashboardOverview({ userId: "admin", role: Role.ADMIN }, now);
    expect(data.primaryTickets.map((item) => item.id)).toEqual(["b", "u", "a", "z"]);
    expect(Object.keys(data.primaryTickets[0]).sort()).toEqual(["assignedAgent", "customer", "effectiveSlaDueAt", "id", "priority", "slaState", "status", "subject", "updatedAt"].sort());
    expect(data.primaryTickets[0]).not.toHaveProperty("effectiveSlaTarget");
  });

  it("builds an AGENT primary queue from active assigned tickets only and orders it deterministically", async () => {
    const agent = { id: "agent-1", name: "Agent" };
    const breached = { ...base, id: "breached", assignedAgent: agent, firstResponseDueAt: new Date(now.getTime() - 1) };
    const risk = { ...base, id: "risk", assignedAgent: agent, firstResponseDueAt: new Date(now.getTime() + 30 * 60_000) };
    const urgent = { ...base, id: "urgent", assignedAgent: agent, priority: TicketPriority.URGENT };
    const high = { ...base, id: "high", assignedAgent: agent, priority: TicketPriority.HIGH };
    const mediumOld = { ...base, id: "medium-a", assignedAgent: agent, updatedAt: new Date("2026-08-24T10:00:00.000Z") };
    const mediumTie = { ...base, id: "medium-b", assignedAgent: agent, updatedAt: mediumOld.updatedAt };
    mocks.findMany.mockReset().mockResolvedValueOnce([breached]).mockResolvedValueOnce([risk]).mockResolvedValueOnce([urgent]).mockResolvedValueOnce([high]).mockResolvedValueOnce([mediumTie, mediumOld]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const data = await getDashboardOverview({ userId: "agent-1", role: Role.AGENT }, now);
    expect(data.primaryQueueType).toBe("MY_ASSIGNED_TICKETS");
    expect(data.primaryTickets.map((item) => item.id)).toEqual(["breached", "risk", "urgent", "high", "medium-a", "medium-b"]);
    for (const call of mocks.findMany.mock.calls.slice(0, 6)) {
      expect(JSON.stringify(call[0].where)).toContain('"assignedAgentId":"agent-1"');
      expect(JSON.stringify(call[0].where)).toContain('"status":{"in"');
      expect(call[0].take).toBe(10);
    }
  });

  it("excludes primary IDs before fetching up to eight deterministic recent tickets", async () => {
    mocks.findMany.mockResolvedValue([]);
    await getDashboardOverview({ userId: "agent-1", role: Role.AGENT }, now);
    expect(mocks.findMany.mock.calls.at(-1)?.[0]).toMatchObject({ take: 8, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
    expect(mocks.groupBy.mock.calls[0][0]).toMatchObject({ by: ["status"], where: { OR: [{ assignedAgentId: "agent-1" }, { assignedAgentId: null }] } });
  });

  it("preserves AGENT assigned-or-unassigned visibility in Recent Tickets and excludes primary IDs", async () => {
    const assigned = { ...base, id: "primary", assignedAgent: { id: "agent-1", name: "Agent" } };
    mocks.findMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([assigned]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await getDashboardOverview({ userId: "agent-1", role: Role.AGENT }, now);
    const recentWhere = mocks.findMany.mock.calls.at(-1)?.[0].where;
    expect(recentWhere).toEqual({ AND: [{ OR: [{ assignedAgentId: "agent-1" }, { assignedAgentId: null }] }, { id: { notIn: ["primary"] } }] });
  });
});
