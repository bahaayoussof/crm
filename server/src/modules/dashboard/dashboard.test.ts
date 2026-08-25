import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() }));
vi.mock("../../config/prisma.js", () => ({ prisma: { ticket: mocks, $transaction: vi.fn() } }));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { deriveSla, getDashboardOverview } from "./dashboard.service.js";

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

  it.each([Role.ADMIN, Role.MANAGER])("allows %s global visibility", async (role) => {
    const response = await request(app).get("/api/dashboard/overview").set(auth("staff-1", role));
    expect(response.status).toBe(200); expect(response.body.data.metrics).toEqual({ openTickets: 5, assignedToMe: 2, unassignedTickets: 1, slaAtRisk: 1, slaBreached: 1, resolvedToday: 3, waitingCustomer: 1 });
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
    mocks.findMany.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([breached]).mockResolvedValueOnce([urgent]).mockResolvedValueOnce([]).mockResolvedValueOnce([highZ, highA]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const data = await getDashboardOverview({ userId: "admin", role: Role.ADMIN }, now);
    expect(data.needsAttention.map((item) => item.id)).toEqual(["b", "u", "a", "z"]);
    expect(Object.keys(data.needsAttention[0]).sort()).toEqual(["assignedAgent", "customer", "effectiveSlaDueAt", "id", "priority", "slaState", "status", "subject", "updatedAt"].sort());
  });

  it("bounds and stably orders recent tickets while grouping only visible tickets", async () => {
    await getDashboardOverview({ userId: "agent-1", role: Role.AGENT }, now);
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ take: 8, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] });
    expect(mocks.groupBy.mock.calls[0][0]).toMatchObject({ by: ["status"], where: { OR: [{ assignedAgentId: "agent-1" }, { assignedAgentId: null }] } });
  });
});
