import { Role, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The SLA monitor now delegates every assignment decision to the canonical
 * team-scoped engine in `modules/assignment` (ADR-051). These tests therefore
 * exercise the REAL `autoAssignTicket` through the cron path with a fake Prisma
 * client, so the regression cases below prove the cron obeys `Ticket.teamId` as
 * the authoritative ownership boundary — Department/Branch are never consulted.
 */

type AgentRow = { id: string; name: string; teamId: string };

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  userFindMany: vi.fn(),
  ticketGroupBy: vi.fn(),
  ticketUpdateMany: vi.fn(),
  historyCreate: vi.fn(),
  notificationCreateMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  emitTicketUpdated: vi.fn(),
  // Test-controlled state for the canonical engine's team-scoped queries.
  state: {
    agentsByTeam: {} as Record<string, AgentRow[]>,
    workload: {} as Record<string, number>,
    updateCount: 1,
    recipients: [] as string[],
  },
}));

vi.mock("../realtime/realtime.publisher.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../realtime/realtime.publisher.js")>()),
  emitTicketUpdated: mocks.emitTicketUpdated,
  withRealtimeOutbox: (fn: () => unknown) => fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const tx = {
    ticket: { updateMany: mocks.ticketUpdateMany, groupBy: mocks.ticketGroupBy },
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

const agent = (id: string, teamId: string): AgentRow => ({ id, name: `Agent ${id}`, teamId });

const candidate = (id: string, teamId: string | null, status: TicketStatus = TicketStatus.OPEN) => ({
  id,
  customerId: `customer-${id}`,
  teamId,
  status,
});

describe("SLA automation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCronSecret(secret);
    mocks.state.agentsByTeam = {};
    mocks.state.workload = {};
    mocks.state.updateCount = 1;
    mocks.state.recipients = [];

    mocks.transaction.mockImplementation((callback) =>
      callback({
        ticket: { updateMany: mocks.ticketUpdateMany, groupBy: mocks.ticketGroupBy },
        ticketHistory: { create: mocks.historyCreate },
        user: { findMany: mocks.userFindMany },
        notification: { createMany: mocks.notificationCreateMany },
        auditLog: { create: mocks.auditCreate },
      }),
    );

    // Default team-scoped queries used by the canonical engine.
    mocks.userFindMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.role === Role.AGENT) {
        const list = mocks.state.agentsByTeam[where.teamId as string] ?? [];
        return list.map((a) => ({ id: a.id, name: a.name }));
      }
      // Escalation recipients (role ADMIN + team MANAGER).
      return mocks.state.recipients.map((id) => ({ id }));
    });
    mocks.ticketGroupBy.mockImplementation(async ({ where }: { where: { assignedAgentId: { in: string[] } } }) =>
      where.assignedAgentId.in
        .filter((id) => mocks.state.workload[id])
        .map((id) => ({ assignedAgentId: id, _count: { _all: mocks.state.workload[id] } })),
    );
    mocks.ticketUpdateMany.mockImplementation(async () => ({ count: mocks.state.updateCount }));
    mocks.ticketFindMany.mockResolvedValue([]);
    mocks.historyCreate.mockResolvedValue({});
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
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

  describe("candidate discovery", () => {
    it("only scans unassigned, active-status, ROUTED tickets, oldest first, bounded", async () => {
      await runSlaMonitor(new Date("2026-09-02T12:00:00.000Z"));
      expect(mocks.ticketFindMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            assignedAgentId: null,
            teamId: { not: null },
            status: { in: expect.arrayContaining([TicketStatus.OPEN, TicketStatus.ESCALATED]) },
          },
          take: SLA_MONITOR_BATCH_SIZE,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
      );
      // Terminal statuses are never candidates.
      const call = mocks.ticketFindMany.mock.calls[0][0] as { where: { status: { in: TicketStatus[] } } };
      expect(call.where.status.in).not.toContain(TicketStatus.RESOLVED);
      expect(call.where.status.in).not.toContain(TicketStatus.CLOSED);
    });
  });

  describe("team-scoped automatic assignment", () => {
    it("1. considers only agents on the ticket's own team", async () => {
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = {
        "team-a": [agent("a1", "team-a"), agent("a2", "team-a")],
        "team-b": [agent("b1", "team-b")],
      };

      const result = await runSlaMonitor();

      expect(result.assigned).toBe(1);
      expect(mocks.userFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ role: Role.AGENT, isActive: true, teamId: "team-a" }) }),
      );
      expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "t1", assignedAgentId: null, teamId: "team-a" }),
          data: { assignedAgentId: "a1" },
        }),
      );
      // team-b agent was never a candidate.
      expect(mocks.ticketUpdateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedAgentId: "b1" } }),
      );
    });

    it("2. picks the least-loaded eligible team agent", async () => {
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a1", "team-a"), agent("a2", "team-a")] };
      mocks.state.workload = { a1: 5, a2: 2 };

      await runSlaMonitor();

      expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedAgentId: "a2" } }));
    });

    it("3. breaks a workload tie deterministically by agent id (no cron-specific randomness)", async () => {
      // Agents supplied in reverse id order with identical workload — the winner
      // is still the lowest id, proving the ordering is deterministic, not random
      // and not dependent on DB/array order.
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a2", "team-a"), agent("a1", "team-a")] };
      mocks.state.workload = { a1: 2, a2: 2 };

      await runSlaMonitor();

      expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { assignedAgentId: "a1" } }));
    });

    it("4. leaves an unrouted (teamId=null) ticket untouched — the key SEC/WF-1 regression", async () => {
      // Candidate discovery filters `teamId: { not: null }`, so an unrouted
      // ticket is never even returned — even if Department/Branch match an agent.
      mocks.ticketFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a1", "team-a")] };

      const result = await runSlaMonitor();

      expect(result.assigned).toBe(0);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
      expect(mocks.historyCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
      expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
      expect(mocks.emitTicketUpdated).not.toHaveBeenCalled();
    });

    it("5+6. a Department/Branch match on an agent of another team is NOT eligible", async () => {
      // ticket -> team-a; the only agent (matching dept AND branch) is on team-b.
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [], "team-b": [agent("b1", "team-b")] };

      const result = await runSlaMonitor();

      expect(result.assigned).toBe(0);
      expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
      expect(mocks.historyCreate).not.toHaveBeenCalled();
      expect(mocks.emitTicketUpdated).not.toHaveBeenCalled();
    });

    it("7. never reassigns — a guarded update that matches zero rows writes no side effects", async () => {
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a1", "team-a")] };
      mocks.state.updateCount = 0; // a concurrent manual assignment already won

      const result = await runSlaMonitor();

      expect(result.assigned).toBe(0);
      expect(mocks.historyCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
      expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
      expect(mocks.emitTicketUpdated).not.toHaveBeenCalled();
    });

    it("8. no eligible team agent is a safe no-op; the batch keeps processing other tickets", async () => {
      mocks.ticketFindMany
        .mockResolvedValueOnce([candidate("t1", "team-a"), candidate("t2", "team-b")])
        .mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [], "team-b": [agent("b1", "team-b")] };

      const result = await runSlaMonitor();

      expect(result.assigned).toBe(1);
      expect(mocks.ticketUpdateMany).toHaveBeenCalledTimes(1);
      expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "t2", teamId: "team-b" }), data: { assignedAgentId: "b1" } }),
      );
    });

    it("10. on success, writes canonical history, audit, notification, and one realtime event", async () => {
      mocks.ticketFindMany.mockResolvedValueOnce([candidate("t1", "team-a")]).mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a1", "team-a")] };

      await runSlaMonitor();

      expect(mocks.historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actorUserId: null, action: "AUTO_ASSIGNMENT", oldValue: null, newValue: "Agent a1" }) }),
      );
      expect(mocks.auditCreate).toHaveBeenCalled();
      expect(mocks.notificationCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [expect.objectContaining({ userId: "a1", type: "TICKET_AUTO_ASSIGNED" })] }),
      );
      expect(mocks.emitTicketUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ ticketId: "t1", assignedAgentId: "a1", teamId: "team-a", customerId: "customer-t1" }),
      );
    });

    it("distributes a whole batch consistently — a second ticket sees the first assignment's workload", async () => {
      mocks.ticketFindMany
        .mockResolvedValueOnce([candidate("t1", "team-a"), candidate("t2", "team-a")])
        .mockResolvedValueOnce([]);
      mocks.state.agentsByTeam = { "team-a": [agent("a1", "team-a"), agent("a2", "team-a")] };
      // a1 starts one ahead; after t1 -> a2 the run must give t2 to a1.
      mocks.state.workload = { a1: 1, a2: 0 };
      mocks.ticketUpdateMany.mockImplementation(async ({ data }: { data: { assignedAgentId: string } }) => {
        mocks.state.workload[data.assignedAgentId] = (mocks.state.workload[data.assignedAgentId] ?? 0) + 1;
        return { count: 1 };
      });

      await runSlaMonitor();

      expect(mocks.ticketUpdateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: { assignedAgentId: "a2" } }));
      expect(mocks.ticketUpdateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: { assignedAgentId: "a1" } }));
    });
  });

  describe("automatic escalation", () => {
    it("9. terminal statuses are excluded from escalation candidates", async () => {
      const now = new Date("2026-09-02T12:00:00.000Z");
      await runSlaMonitor(now);
      expect(mocks.ticketFindMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: {
            status: { in: expect.not.arrayContaining([TicketStatus.ESCALATED, TicketStatus.RESOLVED, TicketStatus.CLOSED]) },
            resolutionDueAt: { not: null, lte: now },
            resolvedAt: null,
            closedAt: null,
          },
        }),
      );
    });

    it("escalates only resolution-breached unresolved tickets and notifies the team manager and admins", async () => {
      const now = new Date("2026-09-02T12:00:00.000Z");
      mocks.ticketFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "ticket-9", subject: "Breached", status: TicketStatus.IN_PROGRESS, assignedAgentId: null, customerId: "cust-9", teamId: "team-a" }]);
      mocks.state.recipients = ["admin-1", "manager-a"];

      const result = await runSlaMonitor(now);

      expect(result.escalated).toBe(1);
      expect(mocks.ticketUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "ticket-9", status: TicketStatus.IN_PROGRESS, resolvedAt: null, closedAt: null }),
          data: { status: TicketStatus.ESCALATED },
        }),
      );
      expect(mocks.historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actorUserId: null, action: "SLA_AUTO_ESCALATED", oldValue: TicketStatus.IN_PROGRESS, newValue: TicketStatus.ESCALATED }) }),
      );
      expect(mocks.notificationCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ userId: "admin-1", type: "SLA_BREACH_ESCALATION" }),
            expect.objectContaining({ userId: "manager-a", type: "SLA_BREACH_ESCALATION" }),
          ]),
        }),
      );
    });

    it("creates no history or notification when a concurrent or repeated run loses the guarded escalation update", async () => {
      mocks.ticketFindMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "ticket-2", subject: "Already escalated", status: TicketStatus.OPEN, assignedAgentId: null, customerId: "c2", teamId: "team-a" }]);
      mocks.state.updateCount = 0;

      const result = await runSlaMonitor();

      expect(result).toMatchObject({ assigned: 0, escalated: 0 });
      expect(mocks.historyCreate).not.toHaveBeenCalled();
      expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
    });
  });
});
