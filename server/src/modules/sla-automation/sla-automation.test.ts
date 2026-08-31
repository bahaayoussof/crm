import { Role, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  userFindMany: vi.fn(),
  ticketUpdateMany: vi.fn(),
  historyCreate: vi.fn(),
  notificationCreateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const tx = {
    ticket: { updateMany: mocks.ticketUpdateMany },
    ticketHistory: { create: mocks.historyCreate },
    user: { findMany: mocks.userFindMany },
    notification: { createMany: mocks.notificationCreateMany },
    auditLog: { create: mocks.auditCreate },
  };
  return {
    prisma: {
      ticket: { findMany: mocks.ticketFindMany },
      user: { findMany: mocks.userFindMany },
      $transaction: mocks.transaction.mockImplementation((callback: (value: typeof tx) => unknown) => callback(tx)),
    },
  };
});

import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { runSlaMonitor, SLA_MONITOR_BATCH_SIZE } from "./sla-automation.service.js";

const secret = "cron-test-secret-that-is-at-least-32-characters";
const setCronSecret = (value: string | undefined) => {
  (env as { CRON_SECRET?: string }).CRON_SECRET = value;
};

const agent = (id: string, activeTicketCount: number, organization: Partial<{ departmentId: string; branchId: string }> = {}) => ({
  id,
  name: `Agent ${id}`,
  departmentId: organization.departmentId ?? null,
  branchId: organization.branchId ?? null,
  _count: { assignedTickets: activeTicketCount },
});

describe("SLA automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCronSecret(secret);
    mocks.transaction.mockImplementation((callback) => callback({
      ticket: { updateMany: mocks.ticketUpdateMany },
      ticketHistory: { create: mocks.historyCreate },
      user: { findMany: mocks.userFindMany },
      notification: { createMany: mocks.notificationCreateMany },
      auditLog: { create: mocks.auditCreate },
    }));
    mocks.ticketFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.ticketUpdateMany.mockResolvedValue({ count: 1 });
    mocks.historyCreate.mockResolvedValue({});
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
  });

  describe("cron authentication", () => {
    it("returns 503 when the scheduler secret is not configured", async () => {
      setCronSecret(undefined);
      const response = await request(app).get("/api/internal/sla-monitor");
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("CRON_NOT_CONFIGURED");
    });

    it("rejects missing, invalid, and ordinary product bearer tokens", async () => {
      expect((await request(app).get("/api/internal/sla-monitor")).status).toBe(401);
      expect((await request(app).get("/api/internal/sla-monitor").set("Authorization", "Bearer wrong")).status).toBe(401);
      expect((await request(app).get("/api/internal/sla-monitor").set("Authorization", "Bearer product-jwt")).status).toBe(401);
      expect(mocks.ticketFindMany).not.toHaveBeenCalled();
    });

    it("runs with the cron bearer secret and returns only an execution summary", async () => {
      const response = await request(app)
        .get("/api/internal/sla-monitor")
        .set("Authorization", `Bearer ${secret}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ assigned: 0, escalated: 0, inspected: { unassigned: 0, breached: 0 } });
      expect(response.body.data.generatedAt).toEqual(expect.any(String));
    });
  });

  it("assigns oldest eligible tickets to the least-loaded matching active agent with id tie-breaking", async () => {
    mocks.ticketFindMany
      .mockResolvedValueOnce([
        { id: "c737ce60fccf9da889f4605c0", subject: "First", departmentId: "dept-1", branchId: "branch-1" },
        { id: "ticket-2", subject: "Second", departmentId: "dept-1", branchId: "branch-1" },
      ])
      .mockResolvedValueOnce([]);
    mocks.userFindMany.mockResolvedValueOnce([
      agent("agent-b", 1, { departmentId: "dept-1", branchId: "branch-1" }),
      agent("agent-a", 1, { departmentId: "dept-1", branchId: "branch-1" }),
      agent("ccca392cf3cad3050adad420d", 0, { departmentId: "dept-2", branchId: "branch-1" }),
    ]);

    const result = await runSlaMonitor(new Date("2026-08-27T12:00:00.000Z"));

    expect(result.assigned).toBe(2);
    expect(mocks.ticketFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ assignedAgentId: null, status: { in: expect.arrayContaining([TicketStatus.ESCALATED]) } }),
      take: SLA_MONITOR_BATCH_SIZE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));
    expect(mocks.userFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { role: Role.AGENT, isActive: true },
      orderBy: { id: "asc" },
    }));
    expect(mocks.ticketUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { assignedAgentId: "agent-a" } }));
    expect(mocks.ticketUpdateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { assignedAgentId: "agent-b" } }));
    expect(mocks.historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: null, action: "AUTO_ASSIGNMENT" }) }));
    expect(mocks.notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ type: "TICKET_AUTO_ASSIGNED", userId: "agent-a", ticketId: "c737ce60fccf9da889f4605c0" })]),
    }));
  });

  it("leaves unmatched tickets unassigned and never opens a mutation transaction", async () => {
    mocks.ticketFindMany
      .mockResolvedValueOnce([{ id: "c737ce60fccf9da889f4605c0", subject: "Scoped", departmentId: "dept-1", branchId: null }])
      .mockResolvedValueOnce([]);
    mocks.userFindMany.mockResolvedValueOnce([agent("agent-1", 0, { departmentId: "dept-2" })]);

    expect((await runSlaMonitor()).assigned).toBe(0);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("escalates only resolution-breached unresolved tickets and notifies active managers and admins", async () => {
    const now = new Date("2026-08-27T12:00:00.000Z");
    mocks.ticketFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "ticket-9", subject: "Breached", status: TicketStatus.IN_PROGRESS }]);
    mocks.userFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "c90b1b286043f1b7612e423c7" }, { id: "c6fd0a01a46ed4545f0a5e774" }]);

    const result = await runSlaMonitor(now);

    expect(result.escalated).toBe(1);
    expect(mocks.ticketFindMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: {
        status: { in: expect.not.arrayContaining([TicketStatus.ESCALATED, TicketStatus.RESOLVED, TicketStatus.CLOSED]) },
        resolutionDueAt: { not: null, lte: now },
        resolvedAt: null,
        closedAt: null,
      },
    }));
    expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "ticket-9", status: TicketStatus.IN_PROGRESS, resolvedAt: null, closedAt: null }),
      data: { status: TicketStatus.ESCALATED },
    }));
    expect(mocks.historyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorUserId: null, action: "SLA_AUTO_ESCALATED", oldValue: TicketStatus.IN_PROGRESS, newValue: TicketStatus.ESCALATED }),
    }));
    expect(mocks.notificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "c90b1b286043f1b7612e423c7", type: "SLA_BREACH_ESCALATION" }),
        expect.objectContaining({ userId: "c6fd0a01a46ed4545f0a5e774", type: "SLA_BREACH_ESCALATION" }),
      ]),
    }));
  });

  it("creates no history or notification when a concurrent or repeated run loses the guarded update", async () => {
    mocks.ticketFindMany
      .mockResolvedValueOnce([{ id: "c737ce60fccf9da889f4605c0", subject: "Already assigned", departmentId: null, branchId: null }])
      .mockResolvedValueOnce([{ id: "ticket-2", subject: "Already escalated", status: TicketStatus.OPEN }]);
    mocks.userFindMany.mockResolvedValueOnce([agent("agent-1", 0)]);
    mocks.ticketUpdateMany.mockResolvedValue({ count: 0 });

    const result = await runSlaMonitor();

    expect(result).toMatchObject({ assigned: 0, escalated: 0 });
    expect(mocks.historyCreate).not.toHaveBeenCalled();
    expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
  });
});
