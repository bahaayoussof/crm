import { TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(),
  ticketUpdateMany: vi.fn(),
  historyCreate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const tx = {
    ticket: { updateMany: mocks.ticketUpdateMany },
    ticketHistory: { create: mocks.historyCreate },
    auditLog: { create: mocks.auditCreate },
  };
  return {
    prisma: {
      ticket: { findMany: mocks.ticketFindMany },
      $transaction: mocks.transaction.mockImplementation((cb: (value: typeof tx) => unknown) => cb(tx)),
    },
  };
});

vi.mock("../realtime/realtime.publisher.js", () => ({
  withRealtimeOutbox: (fn: () => unknown) => fn(),
  emitTicketUpdated: vi.fn(),
  emitTicketMessageCreated: vi.fn(),
  emitNotificationCreated: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { emitTicketUpdated } from "../realtime/realtime.publisher.js";
import { runLiveChatInactivitySweep } from "./live-chat-inactivity.service.js";
import { LIVE_CHAT_INACTIVITY_MINUTES } from "./live-chat.config.js";

const emitUpdated = vi.mocked(emitTicketUpdated);
const secret = "cron-test-secret-that-is-at-least-32-characters";
const setCronSecret = (value: string | undefined) => {
  (env as { CRON_SECRET?: string }).CRON_SECRET = value;
};

const ACTIVE = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
];

const candidate = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "clivechat0000000000000001",
  status: TicketStatus.IN_PROGRESS,
  assignedAgentId: "cagent00000000000000000001",
  customerId: "ccust000000000000000000001",
  teamId: "cteam000000000000000000001",
  ...over,
});

describe("live chat inactivity auto-resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCronSecret(secret);
    mocks.transaction.mockImplementation((cb) =>
      cb({
        ticket: { updateMany: mocks.ticketUpdateMany },
        ticketHistory: { create: mocks.historyCreate },
        auditLog: { create: mocks.auditCreate },
      }),
    );
    mocks.ticketFindMany.mockResolvedValue([]);
    mocks.ticketUpdateMany.mockResolvedValue({ count: 1 });
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  describe("cron authentication", () => {
    it("returns 503 when the scheduler secret is not configured", async () => {
      setCronSecret(undefined);
      const response = await request(app).get("/api/internal/live-chat-inactivity");
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("CRON_NOT_CONFIGURED");
    });

    it("rejects missing / invalid / ordinary product bearer tokens", async () => {
      expect((await request(app).get("/api/internal/live-chat-inactivity")).status).toBe(401);
      expect(
        (await request(app).get("/api/internal/live-chat-inactivity").set("Authorization", "Bearer nope")).status,
      ).toBe(401);
      expect(mocks.ticketFindMany).not.toHaveBeenCalled();
    });

    it("runs with the cron bearer secret and returns only an execution summary", async () => {
      const response = await request(app)
        .get("/api/internal/live-chat-inactivity")
        .set("Authorization", `Bearer ${secret}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ inspected: 0, resolved: 0 });
      expect(response.body.data.generatedAt).toEqual(expect.any(String));
    });
  });

  describe("candidate query — what is eligible", () => {
    it("only looks at LIVE_CHAT, active, already-answered chats with no recent public message", async () => {
      const now = new Date("2026-09-02T12:00:00.000Z");
      await runLiveChatInactivitySweep(now);
      const where = mocks.ticketFindMany.mock.calls[0][0].where;
      expect(where.channel).toBe("LIVE_CHAT");
      expect(where.status.in).toEqual(expect.arrayContaining(ACTIVE));
      expect(where.status.in).not.toContain(TicketStatus.RESOLVED);
      expect(where.status.in).not.toContain(TicketStatus.CLOSED);
      // never auto-resolve an unanswered chat
      expect(where.firstRespondedAt).toEqual({ not: null });
      // inactivity is derived from the newest public TicketMessage, not updatedAt
      const cutoff = new Date(now.getTime() - LIVE_CHAT_INACTIVITY_MINUTES * 60_000);
      expect(where.messages).toEqual({ none: { createdAt: { gt: cutoff } } });
      expect(where).not.toHaveProperty("updatedAt");
    });

    it("bounds the batch and orders oldest-first", async () => {
      await runLiveChatInactivitySweep();
      const args = mocks.ticketFindMany.mock.calls[0][0];
      expect(args.take).toBe(100);
      expect(args.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    });
  });

  describe("resolution", () => {
    it("resolves a stale answered chat: status -> RESOLVED, history, audit, one realtime event", async () => {
      const now = new Date("2026-09-02T12:00:00.000Z");
      mocks.ticketFindMany.mockResolvedValueOnce([candidate()]);

      const result = await runLiveChatInactivitySweep(now);

      expect(result).toMatchObject({ inspected: 1, resolved: 1 });
      const update = mocks.ticketUpdateMany.mock.calls[0][0];
      expect(update.where).toMatchObject({
        id: "clivechat0000000000000001",
        channel: "LIVE_CHAT",
        firstRespondedAt: { not: null },
      });
      expect(update.where.status.in).toEqual(expect.arrayContaining(ACTIVE));
      // final transactional recheck re-tests "no newer qualifying message"
      const cutoff = new Date(now.getTime() - LIVE_CHAT_INACTIVITY_MINUTES * 60_000);
      expect(update.where.messages).toEqual({ none: { createdAt: { gt: cutoff } } });
      expect(update.data).toEqual({ status: "RESOLVED", resolvedAt: now });

      expect(mocks.historyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: "clivechat0000000000000001",
          actorUserId: null,
          action: "STATUS_CHANGED",
          newValue: TicketStatus.RESOLVED,
        }),
      });
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TICKET_STATUS_CHANGED",
            metadata: expect.objectContaining({ reason: "live_chat_inactivity_auto_resolve" }),
          }),
        }),
      );
      expect(emitUpdated).toHaveBeenCalledTimes(1);
      expect(emitUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: "clivechat0000000000000001",
          teamId: "cteam000000000000000000001",
          customerId: "ccust000000000000000000001",
        }),
      );
    });

    it("message race — a newer message makes the final update a no-op (count 0), nothing is resolved", async () => {
      mocks.ticketFindMany.mockResolvedValueOnce([candidate()]);
      mocks.ticketUpdateMany.mockResolvedValue({ count: 0 });

      const result = await runLiveChatInactivitySweep();

      expect(result.resolved).toBe(0);
      expect(mocks.historyCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
      expect(emitUpdated).not.toHaveBeenCalled();
    });

    it("repeated cron execution does not duplicate history or realtime events", async () => {
      mocks.ticketFindMany
        .mockResolvedValueOnce([candidate()]) // first run resolves it
        .mockResolvedValueOnce([]); // second run: no longer active → not a candidate

      await runLiveChatInactivitySweep();
      await runLiveChatInactivitySweep();

      expect(mocks.ticketUpdateMany).toHaveBeenCalledTimes(1);
      expect(mocks.historyCreate).toHaveBeenCalledTimes(1);
      expect(emitUpdated).toHaveBeenCalledTimes(1);
    });

    it("does nothing when there are no stale candidates", async () => {
      const result = await runLiveChatInactivitySweep();
      expect(result).toMatchObject({ inspected: 0, resolved: 0 });
      expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
      expect(emitUpdated).not.toHaveBeenCalled();
    });
  });
});
