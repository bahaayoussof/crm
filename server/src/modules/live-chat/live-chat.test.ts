import { Role, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn(), create: vi.fn() },
  ticketHistory: { create: vi.fn().mockResolvedValue({}) },
  slaRule: { findFirst: vi.fn().mockResolvedValue({ firstResponseMinutes: 30, resolutionMinutes: 120 }) },
  user: { findUnique: vi.fn().mockResolvedValue({ passwordChangedAt: null }) },
}));
vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ...mocks,
    $transaction: vi.fn(async (value: unknown) =>
      typeof value === "function" ? (value as (tx: typeof mocks) => unknown)(mocks) : Promise.all(value as Promise<unknown>[]),
    ),
  },
}));
vi.mock("../realtime/realtime.publisher.js", () => ({
  withRealtimeOutbox: (fn: () => unknown) => fn(),
  emitTicketMessageCreated: vi.fn(),
  emitTicketUpdated: vi.fn(),
  emitNotificationCreated: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { liveChatInternals } from "./live-chat.service.js";
import { emitTicketUpdated } from "../realtime/realtime.publisher.js";

const emitUpdated = vi.mocked(emitTicketUpdated);
const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });
const CUSTOMER_ID = "c0bd7029e0d7aeffc87b34f26";
const CHAT_ID = "cdd8a71b2bbc6072cc903a822";

const detailRow = (status: TicketStatus = TicketStatus.OPEN) => ({
  id: CHAT_ID,
  subject: "Live chat",
  status,
  category: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: "Live chat session started from the customer portal.",
  messages: [],
  feedback: null,
});

describe("portal live chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
    mocks.slaRule.findFirst.mockResolvedValue({ firstResponseMinutes: 30, resolutionMinutes: 120 });
    mocks.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
  });

  it("rejects the anonymous caller and every internal role", async () => {
    expect((await request(app).get("/api/portal/live-chat")).status).toBe(401);
    expect((await request(app).post("/api/portal/live-chat")).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).get("/api/portal/live-chat").set(auth("staff", role))).status).toBe(403);
      expect((await request(app).post("/api/portal/live-chat").set(auth("staff", role))).status).toBe(403);
    }
  });

  it("requires a linked customer profile", async () => {
    mocks.customer.findUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CUSTOMER_PROFILE_REQUIRED");
  });

  it("GET returns null when the customer has no resumable live chat", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null); // resumable lookup
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    // resume lookup is always scoped to the authenticated customer + LIVE_CHAT + non-terminal status
    const where = mocks.ticket.findFirst.mock.calls[0][0].where;
    expect(where.customerId).toBe(CUSTOMER_ID);
    expect(where.channel).toBe("LIVE_CHAT");
    expect(where.status.in).toEqual(expect.arrayContaining([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED]));
    expect(where.status.in).not.toContain(TicketStatus.RESOLVED);
    expect(where.status.in).not.toContain(TicketStatus.CLOSED);
  });

  it("GET resumes the most recent non-terminal live chat", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup
      .mockResolvedValueOnce(detailRow(TicketStatus.IN_PROGRESS)); // ticketDetail
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(response.body.data.status).toBe("IN_PROGRESS");
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(mocks.ticket.findFirst.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });

  it("POST starts a new LIVE_CHAT ticket with server defaults, teamId null when no routing signal exists", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(null) // resumable lookup
      .mockResolvedValueOnce(null) // routing lookup: customer has no prior routed ticket
      .mockResolvedValueOnce(detailRow(TicketStatus.OPEN)); // ticketDetail after create
    mocks.ticket.create.mockResolvedValue({ id: CHAT_ID, customerId: CUSTOMER_ID, teamId: null });

    const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send({});
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);

    const data = mocks.ticket.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      customerId: CUSTOMER_ID,
      status: "OPEN",
      priority: "MEDIUM",
      channel: "LIVE_CHAT",
      assignedAgentId: null,
      teamId: null,
    });
    expect(data.firstResponseDueAt).toBeInstanceOf(Date);
    expect(data.resolutionDueAt).toBeInstanceOf(Date);
    expect(mocks.ticketHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "customer", action: "TICKET_CREATED" }) });
    expect(emitUpdated).toHaveBeenCalledWith(expect.objectContaining({ ticketId: CHAT_ID, assignedAgentId: null, teamId: null }));
    // Fallback path still produces exactly one ticket — no duplicate.
    expect(mocks.ticket.create).toHaveBeenCalledTimes(1);
  });

  it("POST routes the new LIVE_CHAT to the team of the customer's most recent routed ticket", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(null) // resumable lookup
      .mockResolvedValueOnce({ teamId: "tteam111111111111111111111" }) // routing lookup: prior routed ticket
      .mockResolvedValueOnce(detailRow(TicketStatus.OPEN)); // ticketDetail after create
    mocks.ticket.create.mockResolvedValue({ id: CHAT_ID, customerId: CUSTOMER_ID, teamId: "tteam111111111111111111111" });

    const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send({});
    expect(response.status).toBe(201);

    // routing lookup is scoped to this customer, only routed tickets, only active teams, newest first
    const routingWhere = mocks.ticket.findFirst.mock.calls[1][0];
    expect(routingWhere.where).toMatchObject({ customerId: CUSTOMER_ID, teamId: { not: null }, team: { is: { isActive: true } } });
    expect(routingWhere.orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);

    expect(mocks.ticket.create.mock.calls[0][0].data.teamId).toBe("tteam111111111111111111111");
    // realtime audience receives the resolved teamId on the first (and only) event
    expect(emitUpdated).toHaveBeenCalledTimes(1);
    expect(emitUpdated).toHaveBeenCalledWith(expect.objectContaining({ ticketId: CHAT_ID, assignedAgentId: null, teamId: "tteam111111111111111111111" }));
  });

  it("POST resumes instead of creating a duplicate when an active chat exists, and emits nothing", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup
      .mockResolvedValueOnce(detailRow(TicketStatus.OPEN)); // ticketDetail
    const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send({});
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("treats a RESOLVED/CLOSED live chat as terminal and starts a fresh one", async () => {
    // resumable lookup already excludes terminal statuses at the DB layer → returns null
    mocks.ticket.findFirst
      .mockResolvedValueOnce(null) // resumable lookup
      .mockResolvedValueOnce(null) // routing lookup
      .mockResolvedValueOnce(detailRow(TicketStatus.OPEN)); // ticketDetail
    mocks.ticket.create.mockResolvedValue({ id: "cnew111111111111111111111", customerId: CUSTOMER_ID, teamId: null });
    const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send({});
    expect(response.status).toBe(201);
    expect(mocks.ticket.create).toHaveBeenCalledTimes(1);
  });

  it("resumes an existing live chat without re-routing it (no create, no team update event)", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup hits
      .mockResolvedValueOnce(detailRow(TicketStatus.IN_PROGRESS)); // ticketDetail
    const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send({});
    expect(response.status).toBe(201);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    // no routing lookup, no ticket.update, no realtime team change for a resumed chat
    expect(mocks.ticket.findFirst).toHaveBeenCalledTimes(2);
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("resolveLiveChatTeamId only considers this customer's routed tickets on active teams, newest first", async () => {
    const tx = { ticket: { findFirst: vi.fn().mockResolvedValue({ teamId: "tactive11111111111111111a" }) } };
    const result = await liveChatInternals.resolveLiveChatTeamId(tx as never, CUSTOMER_ID);
    expect(result).toBe("tactive11111111111111111a");
    expect(tx.ticket.findFirst).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, teamId: { not: null }, team: { is: { isActive: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { teamId: true },
    });
  });

  it("resolveLiveChatTeamId returns null when the customer has no routed ticket on an active team", async () => {
    const tx = { ticket: { findFirst: vi.fn().mockResolvedValue(null) } };
    expect(await liveChatInternals.resolveLiveChatTeamId(tx as never, CUSTOMER_ID)).toBeNull();
  });

  it("never accepts a client-supplied customerId or any other field", async () => {
    for (const body of [{ customerId: "cd9298a10d1b0735837dc4bd8" }, { channel: "WEB" }, { status: "CLOSED" }, { subject: "x" }]) {
      const response = await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send(body);
      expect(response.status).toBe(400);
    }
    expect(mocks.ticket.create).not.toHaveBeenCalled();
  });

  it("derives the customer strictly from auth, not from any input", async () => {
    mocks.customer.findUnique.mockResolvedValue({ id: "c61b1436de3085c47167cb3c9" });
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    await request(app).get("/api/portal/live-chat").set(auth("cb9b8f9ca9e0d9e79cf06cef9", Role.CUSTOMER));
    expect(mocks.customer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "cb9b8f9ca9e0d9e79cf06cef9" } }));
    expect(mocks.ticket.findFirst.mock.calls[0][0].where.customerId).toBe("c61b1436de3085c47167cb3c9");
  });
});
