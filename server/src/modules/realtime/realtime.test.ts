import { Role } from "@prisma/client";
import type { Request, Response } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { streamRealtimeEvents } from "./realtime.controller.js";
import {
  addSubscriber,
  canReceive,
  publish,
  removeSubscriber,
  __resetRealtimeForTest,
  __subscribersForTest,
} from "./realtime.service.js";
import {
  emitNotificationCreated,
  emitTicketMessageCreated,
  emitTicketUpdated,
  withRealtimeOutbox,
} from "./realtime.publisher.js";

// --- fakes ----------------------------------------------------------------
function fakeResponse() {
  const writes: string[] = [];
  const headers: Record<string, string> = {};
  let ended = false;
  const res = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    getHeader(key: string) {
      return headers[key];
    },
    flushHeaders() {},
    write(chunk: string) {
      if (ended) throw new Error("write after end");
      writes.push(chunk);
      return true;
    },
    end() {
      ended = true;
    },
    on() {},
  };
  return { res: res as unknown as Response, writes, headers, isEnded: () => ended };
}

function fakeRequest(auth: { userId: string; role: Role }) {
  const handlers: Record<string, () => void> = {};
  const req = {
    auth: { ...auth, issuedAt: Math.floor(Date.now() / 1000) },
    socket: { setKeepAlive() {}, setNoDelay() {}, setTimeout() {} },
    on(event: string, cb: () => void) {
      handlers[event] = cb;
    },
  };
  return { req: req as unknown as Request, fire: (event: string) => handlers[event]?.() };
}

const dataOf = (frame: string) => {
  const line = frame.split("\n").find((l) => l.startsWith("data:"));
  return line ? JSON.parse(line.slice("data:".length).trim()) : null;
};

beforeEach(() => __resetRealtimeForTest());
afterEach(() => __resetRealtimeForTest());

// --- SSE connection -----------------------------------------------------
describe("realtime SSE endpoint", () => {
  it("rejects an unauthenticated connection", async () => {
    const response = await request(app).get("/api/realtime/events");
    expect(response.status).toBe(401);
  });

  it("rejects a CUSTOMER connection (internal-only in this scope)", async () => {
    const token = createAccessToken({ id: "cust-1", role: Role.CUSTOMER });
    const response = await request(app).get("/api/realtime/events").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("registers an authenticated connection and writes SSE headers + preamble", () => {
    const { req } = fakeRequest({ userId: "admin-1", role: Role.ADMIN });
    const { res, writes, headers } = fakeResponse();

    streamRealtimeEvents(req, res, vi.fn());

    expect(headers["Content-Type"]).toBe("text/event-stream");
    expect(headers["Cache-Control"]).toContain("no-cache");
    expect(writes.join("")).toContain(": connected");
    expect(writes.join("")).toContain("retry:");
    expect(__subscribersForTest()).toHaveLength(1);
  });

  it("cleans up the subscriber when the client disconnects", () => {
    const { req, fire } = fakeRequest({ userId: "admin-1", role: Role.ADMIN });
    const { res } = fakeResponse();

    streamRealtimeEvents(req, res, vi.fn());
    expect(__subscribersForTest()).toHaveLength(1);

    fire("close");
    expect(__subscribersForTest()).toHaveLength(0);
  });
});

// --- authorization -----------------------------------------------------
describe("realtime authorization (canReceive)", () => {
  const ticketAudience = (assignedAgentId: string | null) =>
    ({ scope: "ticket", ticketId: "t1", assignedAgentId }) as const;

  it("ADMIN and MANAGER receive every ticket event", () => {
    expect(canReceive({ userId: "a", role: Role.ADMIN }, ticketAudience("someone"))).toBe(true);
    expect(canReceive({ userId: "m", role: Role.MANAGER }, ticketAudience("someone"))).toBe(true);
  });

  it("AGENT receives ticket events only for assigned or unassigned tickets", () => {
    expect(canReceive({ userId: "ag", role: Role.AGENT }, ticketAudience("ag"))).toBe(true);
    expect(canReceive({ userId: "ag", role: Role.AGENT }, ticketAudience(null))).toBe(true);
    expect(canReceive({ userId: "ag", role: Role.AGENT }, ticketAudience("other"))).toBe(false);
  });

  it("notification events reach only the intended user", () => {
    const audience = { scope: "user", userId: "u1" } as const;
    expect(canReceive({ userId: "u1", role: Role.AGENT }, audience)).toBe(true);
    expect(canReceive({ userId: "u2", role: Role.ADMIN }, audience)).toBe(false);
  });

  it("publish routes a ticket event past an unauthorized AGENT", () => {
    const admin = fakeResponse();
    const wrongAgent = fakeResponse();
    addSubscriber("admin-1", Role.ADMIN, admin.res);
    addSubscriber("agent-2", Role.AGENT, wrongAgent.res);

    publish({ event: { type: "ticket.updated", ticketId: "t9" }, audience: ticketAudience("agent-1") });

    expect(admin.writes.join("")).toContain("ticket.updated");
    expect(wrongAgent.writes.join("")).toBe("");
  });

  it("publish delivers a notification only to its recipient", () => {
    const u1 = fakeResponse();
    const u2 = fakeResponse();
    addSubscriber("u1", Role.AGENT, u1.res);
    addSubscriber("u2", Role.AGENT, u2.res);

    publish({
      event: { type: "notification.created", notificationId: null },
      audience: { scope: "user", userId: "u1" },
    });

    expect(dataOf(u1.writes[0]!)).toMatchObject({ type: "notification.created" });
    expect(u2.writes).toHaveLength(0);
  });
});

// --- lifecycle -------------------------------------------------------
describe("realtime lifecycle", () => {
  it("handles multiple subscribers for the same user across tabs", () => {
    const tabA = fakeResponse();
    const tabB = fakeResponse();
    addSubscriber("u1", Role.MANAGER, tabA.res);
    addSubscriber("u1", Role.MANAGER, tabB.res);

    publish({
      event: { type: "notification.created", notificationId: null },
      audience: { scope: "user", userId: "u1" },
    });

    expect(tabA.writes).toHaveLength(1);
    expect(tabB.writes).toHaveLength(1);
  });

  it("a write to a dead connection is dropped without throwing and the subscriber is removed", () => {
    const good = fakeResponse();
    const dead = fakeResponse();
    dead.res.end(); // subsequent write throws
    addSubscriber("u1", Role.ADMIN, good.res);
    addSubscriber("u2", Role.ADMIN, dead.res);

    expect(() =>
      publish({ event: { type: "ticket.updated", ticketId: "t1" }, audience: { scope: "ticket", ticketId: "t1", assignedAgentId: null } }),
    ).not.toThrow();

    expect(good.writes.join("")).toContain("ticket.updated");
    expect(__subscribersForTest().map((s) => s.userId)).toEqual(["u1"]);
  });

  it("removeSubscriber is idempotent", () => {
    const { res } = fakeResponse();
    const sub = addSubscriber("u1", Role.ADMIN, res);
    removeSubscriber(sub.id);
    expect(() => removeSubscriber(sub.id)).not.toThrow();
    expect(__subscribersForTest()).toHaveLength(0);
  });
});

// --- transaction-safe publisher (outbox) ---------------------------------
describe("withRealtimeOutbox", () => {
  it("buffers events and flushes them only after the wrapped fn resolves", async () => {
    const u1 = fakeResponse();
    addSubscriber("u1", Role.AGENT, u1.res);

    let writesDuringFn = -1;
    await withRealtimeOutbox(async () => {
      emitNotificationCreated(["u1"]);
      writesDuringFn = u1.writes.length; // not published yet
    });

    expect(writesDuringFn).toBe(0);
    expect(u1.writes).toHaveLength(1);
    expect(dataOf(u1.writes[0]!)).toMatchObject({ type: "notification.created" });
  });

  it("discards buffered events when the wrapped fn throws (rolled-back transaction)", async () => {
    const u1 = fakeResponse();
    addSubscriber("u1", Role.AGENT, u1.res);

    await expect(
      withRealtimeOutbox(async () => {
        emitNotificationCreated(["u1"]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(u1.writes).toHaveLength(0);
  });

  it("publishes immediately when no outbox scope is active", () => {
    const u1 = fakeResponse();
    addSubscriber("u1", Role.AGENT, u1.res);

    emitNotificationCreated(["u1"]);

    expect(u1.writes).toHaveLength(1);
  });

  it("emitTicketMessageCreated carries ticketId, messageId and visibility", () => {
    const admin = fakeResponse();
    addSubscriber("admin-1", Role.ADMIN, admin.res);

    emitTicketMessageCreated({ ticketId: "t1", messageId: "m1", assignedAgentId: null, visibility: "internal" });

    expect(dataOf(admin.writes[0]!)).toEqual({
      type: "ticket.message.created",
      ticketId: "t1",
      messageId: "m1",
      visibility: "internal",
    });
  });

  it("emitNotificationCreated fans out one targeted event per unique recipient", () => {
    const u1 = fakeResponse();
    const u2 = fakeResponse();
    addSubscriber("u1", Role.AGENT, u1.res);
    addSubscriber("u2", Role.AGENT, u2.res);

    emitNotificationCreated(["u1", "u2", "u1"]);

    expect(u1.writes).toHaveLength(1);
    expect(u2.writes).toHaveLength(1);
  });

  it("emitTicketUpdated is not published for callers that never opened a scope mid-rollback", async () => {
    const admin = fakeResponse();
    addSubscriber("admin-1", Role.ADMIN, admin.res);

    await expect(
      withRealtimeOutbox(async () => {
        emitTicketUpdated({ ticketId: "t1", assignedAgentId: null });
        throw new Error("rollback");
      }),
    ).rejects.toThrow();

    expect(admin.writes).toHaveLength(0);
  });
});
