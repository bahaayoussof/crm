import { Role, TicketPriority, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindMany: vi.fn(), ticketCount: vi.fn(), ticketFindFirst: vi.fn(), ticketCreate: vi.fn(), ticketUpdate: vi.fn(),
  ticketUpdateMany: vi.fn(), messageCreate: vi.fn(), noteCreate: vi.fn(),
  historyCreate: vi.fn(), historyCreateMany: vi.fn(), customerFind: vi.fn(), userFindFirst: vi.fn(), userFindMany: vi.fn(),
  categoryFindFirst: vi.fn(), categoryFindMany: vi.fn(), departmentFind: vi.fn(), branchFind: vi.fn(), slaFind: vi.fn(), transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const prisma = {
    ticket: { findMany: mocks.ticketFindMany, count: mocks.ticketCount, findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate, update: mocks.ticketUpdate, updateMany: mocks.ticketUpdateMany },
    ticketMessage: { create: mocks.messageCreate }, ticketNote: { create: mocks.noteCreate },
    ticketHistory: { create: mocks.historyCreate, createMany: mocks.historyCreateMany },
    customer: { findUnique: mocks.customerFind }, user: { findFirst: mocks.userFindFirst, findMany: mocks.userFindMany },
    category: { findFirst: mocks.categoryFindFirst, findMany: mocks.categoryFindMany }, department: { findUnique: mocks.departmentFind },
    branch: { findUnique: mocks.branchFind }, slaRule: { findFirst: mocks.slaFind },
    $transaction: mocks.transaction,
  };
  return { prisma };
});

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const admin = { id: "admin-1", role: Role.ADMIN };
const manager = { id: "manager-1", role: Role.MANAGER };
const agent = { id: "agent-1", role: Role.AGENT };
const otherAgent = { id: "agent-2", role: Role.AGENT };
const auth = (identity = admin) => ({ Authorization: `Bearer ${createAccessToken(identity)}` });
const now = new Date("2026-08-25T08:00:00.000Z");
const summary = {
  id: "ticket-1", subject: "Payment failed", status: TicketStatus.NEW, priority: TicketPriority.HIGH, channel: "WEB",
  firstResponseDueAt: null, firstRespondedAt: null, resolutionDueAt: null, createdAt: now, updatedAt: now,
  customer: { id: "customer-1", name: "Ahmed", email: "ahmed@example.com" }, assignedAgent: null, category: null,
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
      user: { findFirst: mocks.userFindFirst }, category: { findFirst: mocks.categoryFindFirst }, department: { findUnique: mocks.departmentFind },
      branch: { findUnique: mocks.branchFind }, slaRule: { findFirst: mocks.slaFind },
    }) : Promise.all(value as Promise<unknown>[]));
    mocks.customerFind.mockResolvedValue({ id: "customer-1" }); mocks.userFindFirst.mockResolvedValue({ id: "agent-1", name: "Assigned Agent" });
    mocks.categoryFindFirst.mockResolvedValue({ id: "category-1", name: "Billing" }); mocks.departmentFind.mockResolvedValue(null);
    mocks.branchFind.mockResolvedValue(null); mocks.slaFind.mockResolvedValue(null); mocks.historyCreate.mockResolvedValue({});
    mocks.historyCreateMany.mockResolvedValue({ count: 1 }); mocks.ticketCreate.mockResolvedValue(summary); mocks.ticketUpdate.mockResolvedValue(summary);
    mocks.ticketUpdateMany.mockResolvedValue({ count: 1 });
    mocks.messageCreate.mockResolvedValue({ id: "message-1", body: "We are checking this.", createdAt: now, author: { id: admin.id, name: "Admin", role: Role.ADMIN } });
    mocks.noteCreate.mockResolvedValue({ id: "note-1", body: "Check the payment provider.", createdAt: now, author: { id: admin.id, name: "Admin", role: Role.ADMIN } });
    mocks.userFindMany.mockResolvedValue([]); mocks.categoryFindMany.mockResolvedValue([]);
  });

  it("rejects unauthenticated and CUSTOMER access", async () => {
    expect((await request(app).get("/api/tickets")).status).toBe(401);
    const customerToken = createAccessToken({ id: "customer-user", role: Role.CUSTOMER });
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
    const response = await request(app).get("/api/tickets?customerId=customer-1").set(auth(identity));
    expect(response.status).toBe(200);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ customerId: "customer-1" }) }));
    expect(mocks.ticketFindMany.mock.calls.at(-1)?.[0].where).not.toHaveProperty("OR");
  });

  it("intersects customer filtering with AGENT assigned-or-unassigned visibility", async () => {
    mocks.ticketFindMany.mockResolvedValue([summary]); mocks.ticketCount.mockResolvedValue(1);
    const response = await request(app).get("/api/tickets?customerId=customer-1").set(auth(agent));
    expect(response.status).toBe(200);
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      customerId: "customer-1",
      OR: [{ assignedAgentId: agent.id }, { assignedAgentId: null }],
    }) }));
    expect(mocks.ticketCount).toHaveBeenCalledWith({ where: expect.objectContaining({ customerId: "customer-1", OR: expect.any(Array) }) });
  });

  it("returns an empty page when a customer has no tickets visible to AGENT", async () => {
    const response = await request(app).get("/api/tickets?customerId=customer-with-no-visible-tickets").set(auth(agent));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
  });

  it("creates a ticket with SLA snapshots and meaningful history", async () => {
    mocks.slaFind.mockResolvedValue({ firstResponseMinutes: 60, resolutionMinutes: 1440 });
    const response = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "customer-1", priority: "HIGH", categoryId: "category-1", assignedAgentId: "agent-1" });
    expect(response.status).toBe(201);
    expect(mocks.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firstResponseDueAt: expect.any(Date), resolutionDueAt: expect.any(Date) }) }));
    expect(mocks.historyCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "TICKET_CREATED", actorUserId: admin.id }) }));
  });

  it("auto-assigns agent-created tickets and records assignment history", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: agent.id, name: "Assigned Agent" });
    mocks.ticketCreate.mockResolvedValue({ ...summary, assignedAgent: { id: agent.id, name: "Assigned Agent", email: "agent@example.com" } });
    const response = await request(app).post("/api/tickets").set(auth(agent)).send({ subject: "Phone request", description: "Captured by agent", customerId: "customer-1" });
    expect(response.status).toBe(201);
    expect(mocks.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedAgentId: agent.id }) }));
    expect(mocks.historyCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ action: "TICKET_CREATED", actorUserId: agent.id }) }));
    expect(mocks.historyCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ action: "ASSIGNMENT_CHANGED", actorUserId: agent.id, newValue: "Assigned Agent" }) }));
    expect(response.body.data.assignedAgent.id).toBe(agent.id);
  });

  it.each([{ assignedAgentId: agent.id }, { assignedAgentId: otherAgent.id }, { assignedAgentId: null }])("rejects any agent-supplied assignee property: %j", async (body) => {
    const response = await request(app).post("/api/tickets").set(auth(agent)).send({ subject: "Phone request", description: "Captured by agent", customerId: "customer-1", ...body });
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("FORBIDDEN"); expect(mocks.ticketCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid customer and invalid assignment", async () => {
    mocks.customerFind.mockResolvedValueOnce(null);
    const missingCustomer = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "missing" });
    expect(missingCustomer.status).toBe(404); expect(missingCustomer.body.error.code).toBe("CUSTOMER_NOT_FOUND");
    mocks.customerFind.mockResolvedValue({ id: "customer-1" }); mocks.userFindFirst.mockResolvedValueOnce(null);
    const invalidAgent = await request(app).post("/api/tickets").set(auth()).send({ subject: "Payment failed", description: "Card rejected", customerId: "customer-1", assignedAgentId: "customer-user" });
    expect(invalidAgent.status).toBe(400); expect(invalidAgent.body.error.code).toBe("INVALID_ASSIGNED_AGENT");
  });

  it("returns details with history and hides another agent's ticket", async () => {
    mocks.ticketFindFirst.mockResolvedValueOnce({ ...summary, description: "Issue", history: [], department: null, branch: null, messages: [], notes: [] });
    expect((await request(app).get("/api/tickets/ticket-1").set(auth(agent))).status).toBe(200);
    mocks.ticketFindFirst.mockResolvedValueOnce(null);
    const hidden = await request(app).get("/api/tickets/other-ticket").set(auth(agent));
    expect(hidden.status).toBe(404); expect(hidden.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("returns a deterministic discriminated internal conversation", async () => {
    const sameTime = new Date("2026-08-25T09:00:00.000Z");
    mocks.ticketFindFirst.mockResolvedValue({ ...summary, description: "Issue", history: [], department: null, branch: null,
      messages: [{ id: "message-2", body: "Public", createdAt: sameTime, author: { id: agent.id, name: "Agent", role: Role.AGENT } }],
      notes: [{ id: "note-1", body: "Private", createdAt: sameTime, author: { id: admin.id, name: "Admin", role: Role.ADMIN } }],
    });
    const response = await request(app).get("/api/tickets/ticket-1").set(auth());
    expect(response.status).toBe(200);
    expect(response.body.data.conversation.map((item: { kind: string }) => item.kind)).toEqual(["INTERNAL_NOTE", "PUBLIC_MESSAGE"]);
    expect(response.body.data).not.toHaveProperty("notes"); expect(response.body.data).not.toHaveProperty("messages");
  });

  it("creates a public reply with the authenticated author and records first response", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id });
    const response = await request(app).post("/api/tickets/ticket-1/messages").set(auth(agent)).send({ body: "  We are checking this.  " });
    expect(response.status).toBe(201); expect(response.body.data.kind).toBe("PUBLIC_MESSAGE");
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorUserId: agent.id, body: "We are checking this." }) }));
    expect(mocks.ticketUpdateMany).toHaveBeenCalledWith({ where: { id: "ticket-1", firstRespondedAt: null }, data: { firstRespondedAt: expect.any(Date) } });
  });

  it("rejects spoofed authors and empty replies", async () => {
    const spoofed = await request(app).post("/api/tickets/ticket-1/messages").set(auth()).send({ body: "Reply", authorUserId: otherAgent.id });
    const empty = await request(app).post("/api/tickets/ticket-1/messages").set(auth()).send({ body: "   " });
    expect(spoofed.status).toBe(400); expect(empty.status).toBe(400); expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it("stores internal notes separately without recording first response", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id });
    const response = await request(app).post("/api/tickets/ticket-1/notes").set(auth(agent)).send({ body: "  Check provider logs. " });
    expect(response.status).toBe(201); expect(response.body.data.kind).toBe("INTERNAL_NOTE");
    expect(mocks.noteCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorUserId: agent.id, body: "Check provider logs." }) }));
    expect(mocks.messageCreate).not.toHaveBeenCalled(); expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("enforces manager, assigned-agent, unassigned, other-agent, and customer conversation access", async () => {
    const manager = { id: "manager-1", role: Role.MANAGER };
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: otherAgent.id });
    expect((await request(app).post("/api/tickets/ticket-1/messages").set(auth(manager)).send({ body: "Manager reply" })).status).toBe(201);
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: null });
    expect((await request(app).post("/api/tickets/ticket-1/messages").set(auth(agent)).send({ body: "Agent reply" })).status).toBe(403);
    mocks.ticketFindFirst.mockResolvedValue(null);
    expect((await request(app).post("/api/tickets/ticket-1/notes").set(auth(agent)).send({ body: "Hidden" })).status).toBe(404);
    const customerToken = createAccessToken({ id: "customer-user", role: Role.CUSTOMER });
    expect((await request(app).post("/api/tickets/ticket-1/notes").set({ Authorization: `Bearer ${customerToken}` }).send({ body: "No" })).status).toBe(403);
  });

  it("does not record first response when reply creation fails", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ id: summary.id, assignedAgentId: agent.id }); mocks.messageCreate.mockRejectedValueOnce(new Error("write failed"));
    const response = await request(app).post("/api/tickets/ticket-1/messages").set(auth(agent)).send({ body: "Reply" });
    expect(response.status).toBe(500); expect(mocks.ticketUpdateMany).not.toHaveBeenCalled();
  });

  it("updates a valid status and owns resolution timestamps", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ status: "RESOLVED" });
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED", resolvedAt: expect.any(Date) }) }));
    expect(mocks.historyCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ action: "STATUS_CHANGED", oldValue: "IN_PROGRESS", newValue: "RESOLVED" })] });
  });

  it.each(["subject", "description", "categoryId", "departmentId", "branchId", "assignedAgentId"])("rejects assigned-agent updates to forbidden field %s", async (field) => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    const value = field === "subject" ? "Changed subject" : field === "description" ? "Changed description" : "relation-1";
    const response = await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ [field]: value });
    expect(response.status).toBe(403); expect(response.body.error.code).toBe("FORBIDDEN"); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.historyCreateMany).not.toHaveBeenCalled();
  });

  it("rejects mixed allowed and forbidden agent updates atomically", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, assignedAgentId: agent.id });
    const response = await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ status: "OPEN", subject: "Forbidden change" });
    expect(response.status).toBe(403); expect(mocks.ticketUpdate).not.toHaveBeenCalled(); expect(mocks.historyCreateMany).not.toHaveBeenCalled();
  });

  it.each([[Role.ADMIN, "admin-close"], [Role.MANAGER, "manager-close"], [Role.AGENT, "agent-close"]] as const)("allows %s to close an eligible resolved ticket", async (role, id) => {
    const identity = { id: role === Role.AGENT ? agent.id : id, role };
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.RESOLVED, resolvedAt: now, assignedAgentId: role === Role.AGENT ? agent.id : otherAgent.id });
    const response = await request(app).patch("/api/tickets/ticket-1").set(auth(identity)).send({ status: "CLOSED" });
    expect(response.status).toBe(200);
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CLOSED", closedAt: expect.any(Date) }) }));
  });

  it("rejects direct close transitions and unassigned agent close", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    expect((await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ status: "CLOSED" })).status).toBe(409);
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.RESOLVED, assignedAgentId: null });
    expect((await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ status: "CLOSED" })).status).toBe(403);
  });

  it("rejects invalid transitions and agent workflow changes on unassigned tickets", async () => {
    mocks.ticketFindFirst.mockResolvedValue(current);
    const invalid = await request(app).patch("/api/tickets/ticket-1").set(auth()).send({ status: "RESOLVED" });
    expect(invalid.status).toBe(409); expect(invalid.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    const forbidden = await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ priority: "URGENT" });
    expect(forbidden.status).toBe(403);
  });

  it("allows managers to escalate but prevents agents from assigning", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, assignedAgentId: agent.id });
    const manager = { id: "manager-1", role: Role.MANAGER };
    expect((await request(app).patch("/api/tickets/ticket-1").set(auth(manager)).send({ status: "ESCALATED" })).status).toBe(200);
    const assignment = await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ assignedAgentId: otherAgent.id });
    expect(assignment.status).toBe(403);
  });

  it("recalculates unresolved SLA deadlines on priority change", async () => {
    mocks.ticketFindFirst.mockResolvedValue({ ...current, status: TicketStatus.IN_PROGRESS, assignedAgentId: agent.id });
    mocks.slaFind.mockResolvedValue({ firstResponseMinutes: 15, resolutionMinutes: 240 });
    await request(app).patch("/api/tickets/ticket-1").set(auth(agent)).send({ priority: "URGENT" });
    expect(mocks.ticketUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: "URGENT", firstResponseDueAt: expect.any(Date), resolutionDueAt: expect.any(Date) }) }));
  });

  it("returns safe active category and agent lookups", async () => {
    mocks.categoryFindMany.mockResolvedValue([{ id: "category-1", name: "Billing", description: null }]);
    mocks.userFindMany.mockResolvedValue([{ id: "agent-1", name: "Agent", email: "agent@example.com" }]);
    const categories = await request(app).get("/api/categories").set(auth());
    const agents = await request(app).get("/api/users/agents").set(auth());
    expect(categories.status).toBe(200); expect(agents.status).toBe(200);
    expect(agents.body.data[0]).not.toHaveProperty("passwordHash");
  });
});
