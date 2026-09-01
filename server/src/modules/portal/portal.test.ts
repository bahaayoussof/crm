import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { findUnique: vi.fn() }, ticket: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  category: { findMany: vi.fn(), findFirst: vi.fn() }, slaRule: { findFirst: vi.fn() }, ticketMessage: { create: vi.fn() }, ticketHistory: { create: vi.fn() },
  user: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue({ passwordChangedAt: null }) },
  notification: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  ticketWatcher: { findMany: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../config/prisma.js", () => ({ prisma: { ...mocks, $transaction: vi.fn(async (value: unknown) => typeof value === "function" ? (value as (tx: typeof mocks) => unknown)(mocks) : Promise.all(value as Promise<unknown>[])) } }));
vi.mock("../realtime/realtime.publisher.js", () => ({
  withRealtimeOutbox: (fn: () => unknown) => fn(),
  emitTicketMessageCreated: vi.fn(),
  emitTicketUpdated: vi.fn(),
  emitNotificationCreated: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { portalStatus } from "./portal.service.js";
import { emitTicketMessageCreated } from "../realtime/realtime.publisher.js";
const emitMessageMock = vi.mocked(emitTicketMessageCreated);
const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });
const base = { id: "cdd8a71b2bbc6072cc903a822", subject: "Help", status: TicketStatus.OPEN, category: null, createdAt: new Date(), updatedAt: new Date() };

describe("customer portal", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.customer.findUnique.mockResolvedValue({ id: "c0bd7029e0d7aeffc87b34f26" }); mocks.ticket.count.mockResolvedValue(0); mocks.ticket.findMany.mockResolvedValue([]); mocks.category.findMany.mockResolvedValue([]); });

  it("rejects unauthenticated and every internal role", async () => {
    expect((await request(app).get("/api/portal/overview")).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) expect((await request(app).get("/api/portal/overview").set(auth("staff", role))).status).toBe(403);
  });
  it("requires a linked customer profile", async () => { mocks.customer.findUnique.mockResolvedValue(null); const response = await request(app).get("/api/portal/overview").set(auth("customer", Role.CUSTOMER)); expect(response.status).toBe(403); expect(response.body.error.code).toBe("CUSTOMER_PROFILE_REQUIRED"); });
  it("scopes overview counts and recent tickets", async () => { mocks.ticket.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2).mockResolvedValueOnce(1); mocks.ticket.findMany.mockResolvedValue([{ ...base, status: TicketStatus.ESCALATED }]); const response = await request(app).get("/api/portal/overview").set(auth("customer", Role.CUSTOMER)); expect(response.body.data.counts).toEqual({ open: 4, waitingForYou: 2, resolved: 1 }); expect(response.body.data.recentTickets[0].status).toBe("IN_PROGRESS"); expect(mocks.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: "c0bd7029e0d7aeffc87b34f26" }, take: 5, orderBy: [{ updatedAt: "desc" }, { id: "asc" }] })); });
  it("maps every stored status centrally", () => { expect(portalStatus.map).toEqual({ OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", ESCALATED: "IN_PROGRESS", WAITING_CUSTOMER: "WAITING_FOR_YOU", RESOLVED: "RESOLVED", CLOSED: "CLOSED" }); });
  it("lists owned tickets with search, portal status, and pagination", async () => { mocks.ticket.findMany.mockResolvedValue([base]); mocks.ticket.count.mockResolvedValue(21); const response = await request(app).get("/api/portal/tickets?page=2&limit=10&search=Help&status=OPEN").set(auth("customer", Role.CUSTOMER)); expect(response.body.meta).toMatchObject({ page: 2, total: 21, totalPages: 3 }); expect(mocks.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ customerId: "c0bd7029e0d7aeffc87b34f26", status: { in: [TicketStatus.OPEN] } }) })); });

  it("filters owned tickets by priority and category, always ANDed with the authenticated customer", async () => {
    const listTicket = { ...base, priority: TicketPriority.HIGH };
    mocks.ticket.findMany.mockResolvedValue([listTicket]);
    mocks.ticket.count.mockResolvedValue(1);
    const response = await request(app)
      .get("/api/portal/tickets?priority=HIGH&categoryId=cde7c6d191109f42b807f0280&status=IN_PROGRESS&search=Help")
      .set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data[0].priority).toBe("HIGH");
    const call = mocks.ticket.findMany.mock.calls[0][0];
    expect(call.select).toEqual(expect.objectContaining({ priority: true }));
    expect(call.where).toEqual(expect.objectContaining({
      customerId: "c0bd7029e0d7aeffc87b34f26",
      priority: TicketPriority.HIGH,
      categoryId: "cde7c6d191109f42b807f0280",
      status: { in: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED] },
      AND: [{ OR: expect.arrayContaining([{ id: "Help" }]) }],
    }));
    // count uses the identical ownership-scoped predicate
    expect(mocks.ticket.count).toHaveBeenCalledWith({ where: call.where });
  });

  it("rejects unknown / internal-only ticket list filters", async () => {
    for (const qs of ["assignedAgentId=agent-1", "departmentId=dep-1", "branchId=br-1", "customerId=cd9298a10d1b0735837dc4bd8", "priority=SUPER"]) {
      const response = await request(app).get(`/api/portal/tickets?${qs}`).set(auth("customer", Role.CUSTOMER));
      expect(response.status).toBe(400);
    }
  });

  it("keeps one customer's filtered list from ever returning another customer's tickets", async () => {
    // customerIdFor resolves strictly from the authenticated user's linked profile
    mocks.customer.findUnique.mockResolvedValue({ id: "c61b1436de3085c47167cb3c9" });
    mocks.ticket.findMany.mockResolvedValue([]);
    mocks.ticket.count.mockResolvedValue(0);
    await request(app).get("/api/portal/tickets?priority=LOW&categoryId=cba4e847c28b950574a61dd71").set(auth("cb9b8f9ca9e0d9e79cf06cef9", Role.CUSTOMER));
    expect(mocks.customer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "cb9b8f9ca9e0d9e79cf06cef9" } }));
    expect(mocks.ticket.findMany.mock.calls[0][0].where.customerId).toBe("c61b1436de3085c47167cb3c9");
  });
  it("returns IDOR-safe not found and a public-only detail shape", async () => { mocks.ticket.findFirst.mockResolvedValueOnce(null); const missing = await request(app).get("/api/portal/tickets/cd9298a10d1b0735837dc4bd8").set(auth("customer", Role.CUSTOMER)); expect(missing.status).toBe(404); mocks.ticket.findFirst.mockResolvedValueOnce({ ...base, description: "Details", messages: [{ id: "m", body: "Reply", createdAt: new Date(), author: { id: "agent", name: "Mariam", role: Role.ADMIN } }] }); const own = await request(app).get("/api/portal/tickets/cdd8a71b2bbc6072cc903a822").set(auth("customer", Role.CUSTOMER)); expect(own.body.data.messages[0].author).toEqual({ id: "agent", name: "Mariam", kind: "SUPPORT" }); expect(JSON.stringify(own.body)).not.toMatch(/priority|assignee|sla|history|notes|email/i); for (const field of ["slaState", "effectiveSlaDueAt", "effectiveSlaTarget", "firstResponseDueAt", "firstRespondedAt", "resolutionDueAt"]) expect(own.body.data).not.toHaveProperty(field); });
  it("returns active safe categories only", async () => { mocks.category.findMany.mockResolvedValue([{ id: "cat", name: "Billing" }]); const response = await request(app).get("/api/portal/categories").set(auth("customer", Role.CUSTOMER)); expect(response.body.data).toEqual([{ id: "cat", name: "Billing" }]); expect(mocks.category.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true }, select: { id: true, name: true } })); });
  it("rejects client-owned ticket fields and creates with server defaults plus SLA history", async () => { const rejected = await request(app).post("/api/portal/tickets").set(auth("customer", Role.CUSTOMER)).send({ subject: "Need help", description: "Text", customerId: "cd9298a10d1b0735837dc4bd8" }); expect(rejected.status).toBe(400); mocks.slaRule.findFirst.mockResolvedValue({ firstResponseMinutes: 30, resolutionMinutes: 120 }); mocks.ticket.create.mockResolvedValue(base); const response = await request(app).post("/api/portal/tickets").set(auth("customer", Role.CUSTOMER)).send({ subject: "Need help", description: "Text" }); expect(response.status).toBe(201); expect(mocks.ticket.create.mock.calls[0][0].data).toMatchObject({ customerId: "c0bd7029e0d7aeffc87b34f26", status: "OPEN", priority: "MEDIUM", channel: "WEB", assignedAgentId: null }); expect(mocks.ticket.create.mock.calls[0][0].data.firstResponseDueAt).toBeInstanceOf(Date); expect(mocks.ticketHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "customer", action: "TICKET_CREATED" }) }); });
  it.each([[TicketStatus.WAITING_CUSTOMER, TicketStatus.IN_PROGRESS], [TicketStatus.RESOLVED, TicketStatus.OPEN]])("atomically replies and transitions %s", async (from, to) => { mocks.ticket.findFirst.mockResolvedValue({ id: "cdd8a71b2bbc6072cc903a822", status: from }); mocks.ticketMessage.create.mockResolvedValue({ id: "m", body: "Please reopen", createdAt: new Date(), author: { id: "customer", name: "Ahmed", role: Role.CUSTOMER } }); const response = await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "  Please reopen  " }); expect(response.status).toBe(201); expect(mocks.ticketMessage.create.mock.calls[0][0].data).toMatchObject({ authorUserId: "customer", body: "Please reopen" }); expect(mocks.ticket.update).toHaveBeenCalledWith({ where: { id: "cdd8a71b2bbc6072cc903a822" }, data: expect.objectContaining({ status: to }) }); expect(mocks.ticketHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ oldValue: from, newValue: to }) }); expect(JSON.stringify(mocks.ticket.update.mock.calls)).not.toContain("firstRespondedAt"); });
  it("rejects closed and non-owned replies safely", async () => { mocks.ticket.findFirst.mockResolvedValueOnce({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.CLOSED }); expect((await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "reply" })).body.error.code).toBe("TICKET_CLOSED"); mocks.ticket.findFirst.mockResolvedValueOnce(null); expect((await request(app).post("/api/portal/tickets/cd9298a10d1b0735837dc4bd8/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "reply" })).status).toBe(404); });

  it("emits ticket.message.created after a portal reply is persisted, but not for a rejected one", async () => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.OPEN, subject: "Help", assignedAgentId: null });
    mocks.ticketMessage.create.mockResolvedValue({ id: "m1", body: "Thanks", createdAt: new Date(), author: { id: "customer", name: "Ahmed", role: Role.CUSTOMER } });
    await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "Thanks" });
    expect(emitMessageMock).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "cdd8a71b2bbc6072cc903a822", messageId: "m1", visibility: "public" }));

    emitMessageMock.mockClear();
    mocks.ticket.findFirst.mockResolvedValueOnce({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.CLOSED });
    await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "late" });
    expect(emitMessageMock).not.toHaveBeenCalled();
  });

  it("targets a customer reply at the assigned agent + ticket team manager only — never a global ADMIN fan-out", async () => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.OPEN, subject: "Help", assignedAgentId: "agent-a", teamId: "team-a" });
    mocks.ticketMessage.create.mockResolvedValue({ id: "m1", body: "Thanks", createdAt: new Date(), author: { id: "customer", name: "Ahmed", role: Role.CUSTOMER } });
    mocks.ticketWatcher.findMany.mockResolvedValue([]);
    mocks.user.findMany.mockResolvedValue([{ id: "agent-a" }, { id: "mgr-a" }]);

    const res = await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "Thanks" });
    expect(res.status).toBe(201);

    // Staff lookup is the assignee + this team's manager — not the unconditional ADMIN clause.
    expect(mocks.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, OR: [{ id: "agent-a" }, { role: Role.MANAGER, managedTeam: { id: "team-a" } }] },
    }));
    expect(mocks.user.findMany).not.toHaveBeenCalledWith(expect.objectContaining({ where: { role: Role.ADMIN, isActive: true } }));
    const recipientIds = (mocks.notification.createMany.mock.calls.at(-1)![0].data as { userId: string }[]).map((row) => row.userId).sort();
    expect(recipientIds).toEqual(["agent-a", "mgr-a"]);
  });

  it("sends exactly one customer-reply notification when the assigned agent is also a watcher", async () => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.OPEN, subject: "Help", assignedAgentId: "agent-a", teamId: null });
    mocks.ticketMessage.create.mockResolvedValue({ id: "m1", body: "Thanks", createdAt: new Date(), author: { id: "customer", name: "Ahmed", role: Role.CUSTOMER } });
    mocks.ticketWatcher.findMany.mockResolvedValue([{ userId: "agent-a" }, { userId: "watcher-1" }]);
    mocks.user.findMany.mockResolvedValue([{ id: "agent-a" }]);

    const res = await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "Thanks" });
    expect(res.status).toBe(201);
    const recipientIds = (mocks.notification.createMany.mock.calls.at(-1)![0].data as { userId: string }[]).map((row) => row.userId).sort();
    expect(recipientIds).toEqual(["agent-a", "watcher-1"]);
  });

  it("sanitizes the rich portal reply HTML and rejects a markup-only body", async () => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.OPEN });
    mocks.ticketMessage.create.mockResolvedValue({ id: "m", body: "x", createdAt: new Date(), author: { id: "customer", name: "Ahmed", role: Role.CUSTOMER } });
    const ok = await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({
      body: '<p>Still <strong>broken</strong></p><script>alert(1)</script>',
    });
    expect(ok.status).toBe(201);
    const stored = mocks.ticketMessage.create.mock.calls.at(-1)![0].data.body as string;
    expect(stored).toContain("<strong>broken</strong>");
    expect(stored).not.toMatch(/<script/i);

    mocks.ticket.findFirst.mockResolvedValueOnce({ id: "cdd8a71b2bbc6072cc903a822", status: TicketStatus.OPEN });
    const empty = await request(app).post("/api/portal/tickets/cdd8a71b2bbc6072cc903a822/messages").set(auth("customer", Role.CUSTOMER)).send({ body: "<p></p>" });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe("EMPTY_MESSAGE");
  });
});
