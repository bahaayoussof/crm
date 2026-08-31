import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(), ticketCount: vi.fn(), ticketFindFirst: vi.fn(), ticketCreate: vi.fn(), ticketUpdate: vi.fn(),
  ticketUpdateMany: vi.fn(), messageCreate: vi.fn(), noteCreate: vi.fn(),
  historyCreate: vi.fn(), historyCreateMany: vi.fn(), customerFind: vi.fn(), userFindFirst: vi.fn(), userFindMany: vi.fn(),
  categoryFindFirst: vi.fn(), categoryFindMany: vi.fn(), departmentFind: vi.fn(), branchFind: vi.fn(), slaFind: vi.fn(), transaction: vi.fn(),
  watcherCreateMany: vi.fn(), watcherFindMany: vi.fn(), watcherDeleteMany: vi.fn(), watcherCount: vi.fn(), watcherFindFirst: vi.fn(),
  mentionCreateMany: vi.fn(), notificationCreateMany: vi.fn(), auditCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    ticket: { findMany: mocks.ticketFindMany, count: mocks.ticketCount, findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate, update: mocks.ticketUpdate, updateMany: mocks.ticketUpdateMany },
    ticketMessage: { create: mocks.messageCreate }, ticketNote: { create: mocks.noteCreate },
    ticketHistory: { create: mocks.historyCreate, createMany: mocks.historyCreateMany },
    ticketWatcher: { createMany: mocks.watcherCreateMany, findMany: mocks.watcherFindMany, deleteMany: mocks.watcherDeleteMany, count: mocks.watcherCount, findFirst: mocks.watcherFindFirst },
    ticketMention: { createMany: mocks.mentionCreateMany },
    customer: { findUnique: mocks.customerFind }, user: { findFirst: mocks.userFindFirst, findMany: mocks.userFindMany },
    category: { findFirst: mocks.categoryFindFirst, findMany: mocks.categoryFindMany }, department: { findUnique: mocks.departmentFind },
    branch: { findUnique: mocks.branchFind }, slaRule: { findFirst: mocks.slaFind },
    notification: { createMany: mocks.notificationCreateMany },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  };
  return { prisma };
});

vi.mock("../integrations/whatsapp/whatsapp.service.js", () => ({
  deliverOutboundReply: vi.fn().mockResolvedValue({ channel: "WHATSAPP", status: "SENT", externalId: "wamid.OUT" }),
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
import { deliverOutboundReply } from "../integrations/whatsapp/whatsapp.service.js";
const deliverOutboundReplyMock = vi.mocked(deliverOutboundReply);

const admin = { id: "admin-1", role: Role.ADMIN };
const manager = { id: "c6fd0a01a46ed4545f0a5e774", role: Role.MANAGER };
const agent = { id: "c6ff3b3bd11c44cac620c43d5", role: Role.AGENT };
const otherAgent = { id: "cc3544aa158a89417843d45b3", role: Role.AGENT };
const auth = (identity = admin) => ({ Authorization: `Bearer ${createAccessToken(identity)}` });
const now = new Date("2026-08-25T08:00:00.000Z");
const summary = {
  id: "c737ce60fccf9da889f4605c0", subject: "Payment failed", status: TicketStatus.NEW, priority: TicketPriority.HIGH, channel: "WEB",
  firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, createdAt: now, updatedAt: now,
  customer: { id: "ce83f10dcd2c68747c3f3ba14", name: "Ahmed", email: "ahmed@example.com" }, assignedAgent: null, category: null,
};
const current = { id: summary.id, subject: summary.subject, description: "Issue", status: TicketStatus.NEW, priority: TicketPriority.HIGH, categoryId: null, assignedAgentId: null, departmentId: null, branchId: null, firstRespondedAt: null, category: null, assignedAgent: null };

describe("ticket API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ticketFindMany.mockResolvedValue([]); mocks.ticketCount.mockResolvedValue(0);
    mocks.transaction.mockImplementation(async (value: unknown) => typeof value === "function" ? value({
      ticket: { findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate, update: mocks.ticketUpdate, updateMany: mocks.ticketUpdateMany },
      ticketMessage: { create: mocks.messageCreate }, ticketNote: { create: mocks.noteCreate },
      ticketHistory: { create: mocks.historyCreate, createMany: mocks.historyCreateMany }, customer: { findUnique: mocks.customerFind },
      ticketWatcher: { createMany: mocks.watcherCreateMany, findMany: mocks.watcherFindMany, deleteMany: mocks.watcherDeleteMany, count: mocks.watcherCount, findFirst: mocks.watcherFindFirst },
      ticketMention: { createMany: mocks.mentionCreateMany },
      user: { findFirst: mocks.userFindFirst, findMany: mocks.userFindMany },
      category: { findFirst: mocks.categoryFindFirst }, department: { findUnique: mocks.departmentFind },
      branch: { findUnique: mocks.branchFind }, slaRule: { findFirst: mocks.slaFind },
      notification: { createMany: mocks.notificationCreateMany },
      auditLog: { create: mocks.auditCreate },
    }) : Promise.all(value as Promise<unknown>[]));
    mocks.customerFind.mockResolvedValue({ id: "ce83f10dcd2c68747c3f3ba14" }); mocks.userFindFirst.mockResolvedValue({ id: "c6ff3b3bd11c44cac620c43d5", name: "Assigned Agent" });
    mocks.categoryFindFirst.mockResolvedValue({ id: "cbbea6ce8290afd75d03495dd", name: "Billing" }); mocks.departmentFind.mockResolvedValue(null);
    mocks.branchFind.mockResolvedValue(null); mocks.slaFind.mockResolvedValue(null); mocks.historyCreate.mockResolvedValue({});
    mocks.historyCreateMany.mockResolvedValue({ count: 1 }); mocks.ticketCreate.mockResolvedValue(summary); mocks.ticketUpdate.mockResolvedValue(summary);
    mocks.ticketUpdateMany.mockResolvedValue({ count: 1 });
    mocks.messageCreate.mockResolvedValue({ id: "message-1", body: "We are checking this.", createdAt: now, author: { id: admin.id, name: "Admin", role: Role.ADMIN } });
    mocks.noteCreate.mockResolvedValue({ id: "note-1", body: "Check the payment provider.", createdAt: now, author: { id: admin.id, name: "Admin", role: Role.ADMIN } });
    mocks.userFindMany.mockResolvedValue([]); mocks.categoryFindMany.mockResolvedValue([]);
    mocks.watcherCreateMany.mockResolvedValue({ count: 0 }); mocks.watcherFindMany.mockResolvedValue([]);
    mocks.watcherDeleteMany.mockResolvedValue({ count: 0 }); mocks.watcherCount.mockResolvedValue(0);
    mocks.watcherFindFirst.mockResolvedValue(null); mocks.mentionCreateMany.mockResolvedValue({ count: 0 });
    mocks.notificationCreateMany.mockResolvedValue({ count: 0 });
  });

  it("rejects unauthenticated and CUSTOMER access", async () => {
    expect((await request(app).get("/api/tickets")).status).toBe(401);
    const customerToken = createAccessToken({ id: "c8caee0fa37e01411fff0f6eb", role: Role.CUSTOMER });
    expect((await request(app).get("/api/tickets").set({ Authorization: `Bearer ${customerToken}` })).status).toBe(403);
  });

  it("lists with pagination, search, status, and priority filters", async () => {
    mocks.ticketFindMany.mockResolvedValue([summary]); mocks.ticketCount.mockResolvedValue(1);
    const response = await request(app).get("/api/tickets?page=2&limit=10&search=payment&status=NEW&priority=HIGH").set(auth());
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ status: "NEW", priority: "HIGH", AND: expect.any(Array) }) }));
  });

  it("searches by the full ticket ID while retaining subject and customer fields", async () => {
    mocks.ticketFindMany.mockResolvedValue([summary]); mocks.ticketCount.mockResolvedValue(1);
    const response = await request(app).get(`/api/tickets?search=${summary.id}`).set(auth());
    expect(response.status).toBe(200); expect(response.body.data).toHaveLength(1);
    const where = mocks.ticketFindMany.mock.calls[0][0].where;
    expect(where.AND[0].OR).toEqual(expect.arrayContaining([
      { id: summary.id },
      { subject: { contains: summary.id, mode: "insensitive" } },
      { customer: { name: { contains: summary.id, mode: "insensitive" } } },
      { customer: { email: { contains: summary.id, mode: "insensitive" } } },
    ]));
  });

  it("returns zero results for a non-existing ticket ID search", async () => {
    mocks.ticketFindMany.mockResolvedValue([]); mocks.ticketCount.mockResolvedValue(0);
    const response = await request(app).get("/api/tickets?search=missing-ticket-id").set(auth());
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it("keeps AGENT visibility alongside ticket ID search", async () => {
    await request(app).get(`/api/tickets?search=${summary.id}`).set(auth(agent));
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      OR: [{ assignedAgentId: agent.id }, { assignedAgentId: null }], AND: expect.any(Array),
    }) }));
  });

  it("scopes AGENT visibility to assigned and unassigned tickets", async () => {
    await request(app).get("/api/tickets").set(auth(agent));
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ assignedAgentId: agent.id }, { assignedAgentId: null }] }) }));
  });

  it.each([["ADMIN", admin], ["MANAGER", manager]] as const)("filters %s ticket lists by customer without narrowing global role visibility", async (_role, identity) => {
    mocks.ticketFindMany.mockResolvedValue([summary]); mocks.ticketCount.mockResolvedValue(1);
    const response = await request(app).get("/api/tickets?customerId=ce83f10dcd2c68747c3f3ba14").set(auth(identity));
    expect(response.status).toBe(200);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: "ce83f10dcd2c68747c3f3ba14" }) }));
    expect(mocks.ticketFindMany.mock.calls.at(-1)?.[0].where).not.toHaveProperty("OR");
  });

  it("intersects customer filtering with AGENT assigned-or-unassigned visibility", async () => {
    mocks.ticketFindMany.mockResolvedValue([summary]); mocks.ticketCount.mockResolvedValue(1);
    const response = await request(app).get("/api/tickets?customerId=ce83f10dcd2c68747c3f3ba14").set(auth(agent));
    expect(response.status).toBe(200);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      customerId: "ce83f10dcd2c68747c3f3ba14",
      OR: [{ assignedAgentId: agent.id }, { assignedAgentId: null }],
    }) }));
    expect(mocks.ticketCount).toHaveBeenCalledWith({ where: expect.objectContaining({ customerId: "ce83f10dcd2c68747c3f3ba14", OR: expect.any(Array) }) });
  });

  it("returns an empty page when a customer has no tickets visible to AGENT", async () => {
    const response = await request(app).get("/api/tickets?customerId=c970c7e7200f46ef9051b8b5e").set(auth(agent));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it("creates a ticket with SLA snapshots and meaningful history", async () => {
    mocks.slaFind.mockResolvedValue({ firstResponseMinutes: 60, resolutionMinutes: 1440 });
    const response = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "ce83f10dcd2c68747c3f3ba14", priority: "HIGH", categoryId: "cbbea6ce8290afd75d03495dd", assignedAgentId: "c6ff3b3bd11c44cac620c43d5" });
    expect(response.status).toBe(201);
    expect(mocks.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firstResponseDueAt: expect.any(Date), resolutionDueAt: expect.any(Date) }) }));
    expect(mocks.historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TICKET_CREATED", actorUserId: admin.id }) }));
  });

  it("auto-assigns agent-created tickets and records assignment history", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: agent.id, name: "Assigned Agent" });
    mocks.ticketCreate.mockResolvedValue({ ...summary, assignedAgent: { id: agent.id, name: "Assigned Agent", email: "agent@example.com" } });
    const response = await request(app).post("/api/tickets").set(auth(agent)).send({ subject: "Phone request", description: "Captured by agent", customerId: "ce83f10dcd2c68747c3f3ba14" });
    expect(response.status).toBe(201);
    expect(mocks.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedAgentId: agent.id }) }));
    expect(mocks.historyCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ action: "TICKET_CREATED", actorUserId: agent.id }) }));
    expect(mocks.historyCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ action: "ASSIGNMENT_CHANGED", actorUserId: agent.id, newValue: "Assigned Agent" }) }));
    expect(response.body.data.assignedAgent.id).toBe(agent.id);
  });

  it.each([{ assignedAgentId: agent.id }, { assignedAgentId: otherAgent.id }, { assignedAgentId: null }])("rejects any agent-supplied assignee property: %j", async (body) => {
    const response = await request(app).post("/api/tickets").set(auth(agent)).send({ subject: "Phone request", description: "Captured by agent", customerId: "ce83f10dcd2c68747c3f3ba14", ...body });
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("FORBIDDEN"); expect(mocks.ticketCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid customer and invalid assignment", async () => {
    mocks.customerFind.mockResolvedValueOnce(null);
    const missingCustomer = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "c1bececfe976a00bda0671c13" });
    expect(missingCustomer.status).toBe(404); expect(missingCustomer.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    mocks.customerFind.mockResolvedValue({ id: "ce83f10dcd2c68747c3f3ba14" }); mocks.userFindFirst.mockResolvedValueOnce(null);
    const invalidAgent = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "ce83f10dcd2c68747c3f3ba14", assignedAgentId: "c8caee0fa37e01411fff0f6eb" });
    expect(invalidAgent.status).toBe(400); expect(invalidAgent.body.error.code).toBe("INVALID_ASSIGNED_AGENT");
  });

  it("returns details with history and hides another agent's ticket", async () => {
    mocks.ticketFindFirst.mockResolvedValueOnce({ ...summary, description: "Issue", history: [], department: null, branch: null, messages: [], notes: [] });
    expect((await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent))).status).toBe(200);
    mocks.ticketFindFirst.mockResolvedValueOnce(null);
    const hidden = await request(app).get("/api/tickets/ce4f9cfc9bf9577676c859a1b").set(auth(agent));
    expect(hidden.status).toBe(404); expect(hidden.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it.each([admin, manager, agent])("returns derived SLA and raw snapshots to authorized $role detail reads", async (identity) => {
    const firstResponseDueAt = new Date("2099-08-26T12:00:00.000Z");
    const resolutionDueAt = new Date("2099-08-27T12:00:00.000Z");
    mocks.ticketFindFirst.mockResolvedValue({ ...summary, firstResponseDueAt, resolutionDueAt, description: "Issue", resolvedAt: null, closedAt: null, history: [], department: null, branch: null, messages: [], notes: [] });
    const response = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(identity));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      slaState: "ON_TRACK",
      effectiveSlaDueAt: firstResponseDueAt.toISOString(),
      effectiveSlaTarget: "FIRST_RESPONSE",
      firstResponseDueAt: firstResponseDueAt.toISOString(),
      firstRespondedAt: null,
      resolutionDueAt: resolutionDueAt.toISOString(),
      resolvedAt: null,
      closedAt: null,
    });
  });

  it("rejects unauthenticated and CUSTOMER internal Ticket Details reads", async () => {
    expect((await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0")).status).toBe(401);
    const customerToken = createAccessToken({ id: "c8caee0fa37e01411fff0f6eb", role: Role.CUSTOMER });
    expect((await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0").set({ Authorization: `Bearer ${customerToken}` })).status).toBe(403);
    expect(mocks.ticketFindFirst).not.toHaveBeenCalled();
  });

  it("returns a deterministic discriminated internal conversation", async () => {
    const sameTime = new Date("2026-08-25T09:00:00.000Z");
    mocks.ticketFindFirst.mockResolvedValue({ ...summary, description: "Issue", history: [], department: null, branch: null,
      messages: [{ id: "message-2", body: "Public", createdAt: sameTime, author: { id: agent.id, name: "Agent", role: Role.AGENT } }],
      notes: [{ id: "note-1", body: "Private", createdAt: sameTime, author: { id: admin.id, name: "Admin", role: Role.ADMIN } }],
    });
    const response = await request(app).get("/api/tickets/c737ce60fccf9da889f4605c0").set(auth());
    expect(response.status).toBe(200);
    expect(response.body.data.conversation.map((item: { kind: string }) => item.kind)).toEqual(["INTERNAL_NOTE", "PUBLIC_MESSAGE"]);
    expect(response.body.data).not.toHaveProperty("notes"); expect(response.body.data).not.toHaveProperty("messages");
  });

  it("creates a public reply with the authenticated author and records first response", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "  We are checking this.  " });
    expect(response.status).toBe(201); expect(response.body.data.kind).toBe("PUBLIC_MESSAGE");
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorUserId: agent.id, body: "We are checking this." }) }));
    expect(mocks.ticketUpdateMany).toHaveBeenCalledWith({ where: { id: "c737ce60fccf9da889f4605c0", firstRespondedAt: null }, data: { firstRespondedAt: expect.any(Date) } });
  });

  it("rejects spoofed authors and empty replies", async () => {
    const spoofed = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth()).send({ body: "Reply", authorUserId: otherAgent.id });
    const empty = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth()).send({ body: "   " });
    expect(spoofed.status).toBe(400); expect(empty.status).toBe(400); expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("stores internal notes separately without recording first response", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, subject: "Payment failed", assignedAgentId: agent.id });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({ body: "  Check provider logs. " });
    expect(response.status).toBe(201); expect(response.body.data.kind).toBe("INTERNAL_NOTE");
    expect(mocks.noteCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorUserId: agent.id, body: "Check provider logs." }) }));
    expect(mocks.messageCreate).not.toHaveBeenCalled(); expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("records @mentions on a new note: mention rows, auto-watch, and one mention notification", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, subject: "Payment failed", assignedAgentId: agent.id });
    mocks.noteCreate.mockResolvedValue({ id: "c41f6dea3f903c8730b9c2d34", body: "please review", createdAt: now, author: { id: agent.id, name: "Assigned Agent", role: Role.AGENT } });
    mocks.userFindMany.mockResolvedValue([{ id: "c6fd0a01a46ed4545f0a5e774" }]); // active internal user resolution
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({ body: "please review @[Manager](c6fd0a01a46ed4545f0a5e774) and @[Me](c6ff3b3bd11c44cac620c43d5)" });
    expect(response.status).toBe(201);
    // self-mention (c6ff3b3bd11c44cac620c43d5 = author) is dropped before the lookup
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["c6fd0a01a46ed4545f0a5e774"] } }) }));
    expect(mocks.mentionCreateMany).toHaveBeenCalledWith({ data: [{ noteId: "c41f6dea3f903c8730b9c2d34", mentionedUserId: "c6fd0a01a46ed4545f0a5e774", ticketId: "c737ce60fccf9da889f4605c0" }], skipDuplicates: true });
    expect(mocks.watcherCreateMany).toHaveBeenCalledWith({ data: [{ ticketId: "c737ce60fccf9da889f4605c0", userId: "c6ff3b3bd11c44cac620c43d5" }, { ticketId: "c737ce60fccf9da889f4605c0", userId: "c6fd0a01a46ed4545f0a5e774" }], skipDuplicates: true });
    const mentionNotify = mocks.notificationCreateMany.mock.calls.find(([arg]) => arg.data?.[0]?.type === "TICKET_MENTION");
    expect(mentionNotify?.[0].data).toHaveLength(1);
    expect(mentionNotify?.[0].data[0]).toMatchObject({ userId: "c6fd0a01a46ed4545f0a5e774", ticketId: "c737ce60fccf9da889f4605c0" });
  });

  it("does not send a watcher activity notification to a mentioned user for the same note", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, subject: "Payment failed", assignedAgentId: agent.id });
    mocks.noteCreate.mockResolvedValue({ id: "c41f6dea3f903c8730b9c2d34", body: "x", createdAt: now, author: { id: agent.id, name: "Assigned Agent", role: Role.AGENT } });
    mocks.userFindMany.mockResolvedValue([{ id: "c6fd0a01a46ed4545f0a5e774" }]);
    // pre-existing watchers: the mentioned manager plus an unrelated follower
    mocks.watcherFindMany.mockResolvedValue([{ userId: "c6fd0a01a46ed4545f0a5e774" }, { userId: "c311ceb7e79d65d2d38dc59b2" }, { userId: "c6ff3b3bd11c44cac620c43d5" }]);
    await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({ body: "@[Manager](c6fd0a01a46ed4545f0a5e774)" });
    const watchNotify = mocks.notificationCreateMany.mock.calls.find(([arg]) => arg.data?.[0]?.type === "TICKET_WATCH_ACTIVITY");
    expect(watchNotify?.[0].data.map((d: { userId: string }) => d.userId)).toEqual(["c311ceb7e79d65d2d38dc59b2"]); // not manager-1 (mentioned), not c6ff3b3bd11c44cac620c43d5 (actor)
  });

  it("enforces manager, assigned-agent, unassigned, other-agent, and customer conversation access", async () => {
    const manager = { id: "c6fd0a01a46ed4545f0a5e774", role: Role.MANAGER };
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: otherAgent.id });
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(manager)).send({ body: "Manager reply" })).status).toBe(201);
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: null });
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "Agent reply" })).status).toBe(403);
    mocks.ticketFindFirst.mockResolvedValue(null);
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({ body: "Hidden" })).status).toBe(404);
    const customerToken = createAccessToken({ id: "c8caee0fa37e01411fff0f6eb", role: Role.CUSTOMER });
    expect((await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set({ Authorization: `Bearer ${customerToken}` }).send({ body: "No" })).status).toBe(403);
  });

  it("sends the reply through the WhatsApp service for WHATSAPP-channel tickets", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id, channel: "WHATSAPP", customer: { phone: "+15551230000" } });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "On our way" });
    expect(response.status).toBe(201);
    expect(deliverOutboundReplyMock).toHaveBeenCalledWith({ ticketId: "c737ce60fccf9da889f4605c0", messageId: "message-1", to: "+15551230000", text: "On our way" });
    expect(response.body.data.delivery).toMatchObject({ channel: "WHATSAPP", status: "SENT" });
  });

  it("does not invoke WhatsApp transport for non-WHATSAPP tickets", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id, channel: "WEB", customer: { phone: "+15551230000" } });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "Web reply" });
    expect(response.status).toBe(201);
    expect(deliverOutboundReplyMock).not.toHaveBeenCalled();
  });

  it("keeps RBAC ahead of WhatsApp transport for an unassigned agent", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: otherAgent.id, channel: "WHATSAPP", customer: { phone: "+15551230000" } });
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "nope" });
    expect(response.status).toBe(403);
    expect(deliverOutboundReplyMock).not.toHaveBeenCalled();
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("does not record first response when reply creation fails", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id }); mocks.messageCreate.mockRejectedValueOnce(new Error("write failed"));
    const response = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "Reply" });
    expect(response.status).toBe(500); expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("sanitizes public reply HTML: keeps support formatting, drops scripts / handlers / unsafe hrefs", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id });
    const res = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({
      body:
        '<p>Hi <strong>there</strong> <em>team</em></p><ul><li>one</li></ul>' +
        '<script>alert(1)</script><img src=x onerror="alert(1)">' +
        '<a href="javascript:evil()">bad</a> <a href="https://example.com/help">good</a>' +
        '<div style="position:fixed">x</div>',
    });
    expect(res.status).toBe(201);
    const stored = (mocks.messageCreate.mock.calls.at(-1)![0] as { data: { body: string } }).data.body;
    expect(stored).toContain("<strong>there</strong>");
    expect(stored).toContain("<li>one</li>");
    expect(stored).not.toMatch(/<script|onerror|<img|javascript:|<div|style=/i);
    expect(stored).toContain('href="https://example.com/help"');
    expect(stored).toMatch(/rel="noopener noreferrer nofollow"/);
    expect(stored).toMatch(/target="_blank"/);
  });

  it("rejects a reply that is empty once sanitized (markup only)", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id });
    const res = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({ body: "<br><br><p></p>" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("EMPTY_MESSAGE");
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("sanitizes internal-note HTML (same rich editor as replies) and keeps @mention tokens intact", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, subject: "Payment failed", assignedAgentId: agent.id });
    mocks.userFindMany.mockResolvedValue([{ id: "c6fd0a01a46ed4545f0a5e774" }]);
    mocks.noteCreate.mockResolvedValue({ id: "note-h", body: "x", createdAt: now, author: { id: agent.id, name: "Assigned Agent", role: Role.AGENT } });
    const res = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({
      body: '<p>Please review <strong>this</strong> @[Manager](c6fd0a01a46ed4545f0a5e774)</p><script>alert(1)</script>',
    });
    expect(res.status).toBe(201);
    const stored = (mocks.noteCreate.mock.calls.at(-1)![0] as { data: { body: string } }).data.body;
    expect(stored).toContain("<strong>this</strong>");
    expect(stored).not.toMatch(/<script/i);
    expect(stored).toContain("@[Manager](c6fd0a01a46ed4545f0a5e774)");
    // mention parsing runs on the sanitized body and still resolves the manager
    expect(mocks.mentionCreateMany).toHaveBeenCalledWith({
      data: [{ noteId: "note-h", mentionedUserId: "c6fd0a01a46ed4545f0a5e774", ticketId: "c737ce60fccf9da889f4605c0" }],
      skipDuplicates: true,
    });
  });

  it("rejects an internal note that is empty once sanitized (markup only)", async () => {
    const res = await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/notes").set(auth(agent)).send({ body: "<p></p><br>" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("EMPTY_MESSAGE");
    expect(mocks.noteCreate).not.toHaveBeenCalled();
  });

  it("delivers plain text (never markup) to WhatsApp", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id, channel: "WHATSAPP", customer: { phone: "+15551230000" } });
    await request(app).post("/api/tickets/c737ce60fccf9da889f4605c0/messages").set(auth(agent)).send({
      body: "<p>Line one</p><ul><li>alpha</li><li>beta</li></ul>",
    });
    const arg = deliverOutboundReplyMock.mock.calls.at(-1)![0] as { text: string };
    expect(arg.text).not.toMatch(/<[a-z/]/i);
    expect(arg.text).toContain("Line one");
    expect(arg.text).toContain("alpha");
    expect(arg.text).toContain("beta");
  });

  it("updates a valid status and owns resolution timestamps", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ status: "RESOLVED" });
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED", resolvedAt: expect.any(Date) }) }));
    expect(mocks.historyCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ action: "STATUS_CHANGED", oldValue: "IN_PROGRESS", newValue: "RESOLVED" })] });
  });

  it.each(["subject", "description", "categoryId", "departmentId", "branchId", "assignedAgentId"])("rejects assigned-agent updates to forbidden field %s", async (field) => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    const value = field === "subject" ? "Changed subject" : field === "description" ? "Changed description" : "cdec480321f4d7a8c2c91bcb3";
    const response = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ [field]: value });
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("FORBIDDEN"); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.historyCreateMany).not.toHaveBeenCalled();
  });

  it("rejects mixed allowed and forbidden agent updates atomically", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, assignedAgentId: agent.id });
    const response = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ status: "OPEN", subject: "Forbidden change" });
    expect(response.status).toBe(403); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.historyCreateMany).not.toHaveBeenCalled();
  });

  it.each([[Role.ADMIN, "admin-close"], [Role.MANAGER, "manager-close"], [Role.AGENT, "c39addd414605e2a812c8668d"]] as const)("allows %s to close an eligible resolved ticket", async (role, id) => {
    const identity = { id: role === Role.AGENT ? agent.id : id, role };
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.RESOLVED, resolvedAt: now, assignedAgentId: role === Role.AGENT ? agent.id : otherAgent.id });
    const response = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(identity)).send({ status: "CLOSED" });
    expect(response.status).toBe(200);
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED", closedAt: expect.any(Date) }) }));
  });

  it("rejects direct close transitions and unassigned agent close", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    expect((await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ status: "CLOSED" })).status).toBe(409);
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.RESOLVED, assignedAgentId: null });
    expect((await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ status: "CLOSED" })).status).toBe(403);
  });

  it("rejects invalid transitions and agent workflow changes on unassigned tickets", async () => {
    mocks.ticketFindFirst.mockResolvedValue(current);
    const invalid = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth()).send({ status: "RESOLVED" });
    expect(invalid.status).toBe(409); expect(invalid.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const forbidden = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ priority: "URGENT" });
    expect(forbidden.status).toBe(403);
  });

  it("allows managers to escalate but prevents agents from assigning", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, assignedAgentId: agent.id });
    const manager = { id: "c6fd0a01a46ed4545f0a5e774", role: Role.MANAGER };
    expect((await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(manager)).send({ status: "ESCALATED" })).status).toBe(200);
    const assignment = await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ assignedAgentId: otherAgent.id });
    expect(assignment.status).toBe(403);
  });

  it("recalculates unresolved SLA deadlines on priority change", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    mocks.slaFind.mockResolvedValue({ firstResponseMinutes: 15, resolutionMinutes: 240 });
    await request(app).patch("/api/tickets/c737ce60fccf9da889f4605c0").set(auth(agent)).send({ priority: "URGENT" });
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT", firstResponseDueAt: expect.any(Date), resolutionDueAt: expect.any(Date) }) }));
  });

  it("returns safe active category and agent lookups", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ id: "cbbea6ce8290afd75d03495dd", name: "Billing", description: null }]);
    mocks.userFindMany.mockResolvedValue([{ id: "c6ff3b3bd11c44cac620c43d5", name: "Agent", email: "agent@example.com" }]);
    const categories = await request(app).get("/api/categories").set(auth());
    const agents = await request(app).get("/api/users/agents").set(auth());
    expect(categories.status).toBe(200); expect(agents.status).toBe(200);
    expect(agents.body.data[0]).not.toHaveProperty("passwordHash");
  });
});
