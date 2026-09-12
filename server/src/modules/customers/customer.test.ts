import { Prisma, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), countCustomers: vi.fn(), findCustomer: vi.fn(), findFirstCustomer: vi.fn(), createCustomer: vi.fn(),
  updateCustomer: vi.fn(), deleteCustomer: vi.fn(), transaction: vi.fn(),
  groupTickets: vi.fn(), countTickets: vi.fn(), findTickets: vi.fn(), findNotes: vi.fn(), createNote: vi.fn(), auditCreate: vi.fn(),
  userFindUnique: vi.fn(),
}));

// feature/team-based-manager-scope — resolveActorTeamId() does one user.findUnique.
const TEAM_A = "cteamaaaaaaaaaaaaaaaaaaaa1";

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    customer: {
      findMany: mocks.findMany, count: mocks.countCustomers, findUnique: mocks.findCustomer, findFirst: mocks.findFirstCustomer,
      create: mocks.createCustomer, update: mocks.updateCustomer, delete: mocks.deleteCustomer,
    },
    ticket: { groupBy: mocks.groupTickets, count: mocks.countTickets, findMany: mocks.findTickets },
    user: { findUnique: mocks.userFindUnique },
    customerNote: { findMany: mocks.findNotes, create: mocks.createNote },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const adminToken = createAccessToken({ id: "admin-1", role: Role.ADMIN });
const managerToken = createAccessToken({ id: "c6fd0a01a46ed4545f0a5e774", role: Role.MANAGER });
const agentToken = createAccessToken({ id: "agent-1", role: Role.AGENT });
const customerToken = createAccessToken({ id: "portal-1", role: Role.CUSTOMER });
const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
const now = new Date("2026-08-24T12:00:00.000Z");
const customer = { id: "ce83f10dcd2c68747c3f3ba14", name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+14155552671", createdAt: now, updatedAt: now };

describe("customer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.countCustomers.mockResolvedValue(0);
    mocks.findFirstCustomer.mockResolvedValue(null);
    mocks.transaction.mockImplementation(async (value: unknown) => typeof value === "function" ? (value as (tx: unknown) => unknown)({ customer: { findUnique: mocks.findCustomer, create: mocks.createCustomer, update: mocks.updateCustomer, delete: mocks.deleteCustomer }, customerNote: { create: mocks.createNote }, auditLog: { create: mocks.auditCreate } }) : Promise.all(value as Promise<unknown>[]));
    mocks.groupTickets.mockResolvedValue([]);
    mocks.countTickets.mockResolvedValue(0);
    mocks.findNotes.mockResolvedValue([]);
    mocks.findTickets.mockResolvedValue([]);
    // Default team resolution: the manager token LEADS team A; agent-1 is a MEMBER of team A.
    mocks.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "c6fd0a01a46ed4545f0a5e774"
        ? { teamId: TEAM_A, managedTeam: { id: TEAM_A } }
        : where.id === "agent-1"
          ? { teamId: TEAM_A, managedTeam: null }
          : { teamId: null, managedTeam: null });
  });

  it("rejects unauthenticated and CUSTOMER-role access", async () => {
    const unauthenticated = await request(app).get("/api/customers");
    const portalUser = await request(app).get("/api/customers").set(auth(customerToken));
    expect(unauthenticated.status).toBe(401);
    expect(portalUser.status).toBe(403);
  });

  it.each([
    ["ADMIN", adminToken], ["MANAGER", managerToken], ["AGENT", agentToken],
  ])("allows %s to list and search customers", async (_role, token) => {
    const response = await request(app).get("/api/customers?search=Ahmed").set(auth(token));
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: expect.any(Array) } }));
  });

  it("allows AGENT to view customer details and existing notes", async () => {
    mocks.findCustomer.mockResolvedValue({ ...customer, user: null, attachments: [], tickets: [], _count: { tickets: 0 } });
    mocks.findNotes.mockResolvedValue([{ id: "cea503d892f34f0298079b79d", body: "Existing note", createdAt: now, author: { id: "admin-1", name: "Admin", role: Role.ADMIN } }]);
    const detailResponse = await request(app).get(`/api/customers/${customer.id}`).set(auth(agentToken));
    const notesResponse = await request(app).get(`/api/customers/${customer.id}/notes`).set(auth(agentToken));
    expect(detailResponse.status).toBe(200);
    expect(notesResponse.status).toBe(200);
    expect(notesResponse.body.data[0].body).toBe("Existing note");
  });

  it("returns every safe customer ticket summary org-wide with FULL access for ADMIN", async () => {
    mocks.findCustomer.mockResolvedValue({ id: customer.id });
    mocks.findTickets.mockResolvedValue([
      { id: "c737ce60fccf9da889f4605c0", subject: "Assigned", status: "OPEN", priority: "HIGH", createdAt: now, updatedAt: now, assignedAgentId: "agent-1", category: null, assignedAgent: { id: "agent-1", name: "Agent" } },
      { id: "ticket-2", subject: "Other", status: "WAITING_CUSTOMER", priority: "LOW", createdAt: now, updatedAt: now, assignedAgentId: "cc3544aa158a89417843d45b3", category: null, assignedAgent: { id: "cc3544aa158a89417843d45b3", name: "Other Agent" } },
    ]);
    mocks.countTickets.mockResolvedValue(2);
    const response = await request(app).get(`/api/customers/${customer.id}/tickets?page=1&limit=20`).set(auth(adminToken));
    expect(response.status).toBe(200);
    expect(response.body.data.map((ticket: { access: string }) => ticket.access)).toEqual(["FULL", "FULL"]);
    // ADMIN → no team predicate (org-wide).
    expect(mocks.findTickets).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: customer.id }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: 0, take: 20 }));
  });

  // -------------------------------------------------------------------------
  // OD-6 / TK-008 + TK-009 — MANAGER customer-ticket history is team-scoped
  // (replaces the pre-OD-6 assertion that a MANAGER saw every ticket, "FULL")
  // -------------------------------------------------------------------------
  describe("MANAGER customer-ticket visibility (OD-6)", () => {
    it("scopes the query to the manager's managed team", async () => {
      mocks.findCustomer.mockResolvedValue({ id: customer.id });
      mocks.findTickets.mockResolvedValue([
        { id: "c737ce60fccf9da889f4605c0", subject: "In team", status: "OPEN", priority: "HIGH", createdAt: now, updatedAt: now, assignedAgentId: "agent-1", category: null, assignedAgent: { id: "agent-1", name: "Agent" } },
      ]);
      mocks.countTickets.mockResolvedValue(1);
      const response = await request(app).get(`/api/customers/${customer.id}/tickets?page=1&limit=20`).set(auth(managerToken));
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.meta.total).toBe(1);
      expect(response.body.data[0].access).toBe("FULL");
      const where = mocks.findTickets.mock.calls.at(-1)![0].where;
      expect(where).toEqual({ customerId: customer.id, teamId: TEAM_A });
      expect(mocks.countTickets).toHaveBeenCalledWith({ where });
    });

    it("returns an empty page for a MANAGER with no managed team (no org-wide fallback)", async () => {
      mocks.userFindUnique.mockImplementation(async () => ({ teamId: null, managedTeam: null }));
      mocks.findCustomer.mockResolvedValue({ id: customer.id });
      mocks.findTickets.mockResolvedValue([]);
      mocks.countTickets.mockResolvedValue(0);
      const response = await request(app).get(`/api/customers/${customer.id}/tickets`).set(auth(managerToken));
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ data: [], meta: { total: 0, totalPages: 0 } });
      expect(mocks.findTickets.mock.calls.at(-1)![0].where).toEqual({ customerId: customer.id, id: { in: [] } });
    });

    it("never exposes cross-team ticket metadata — the where predicate carries the team id", async () => {
      mocks.findCustomer.mockResolvedValue({ id: customer.id });
      mocks.findTickets.mockResolvedValue([]);
      mocks.countTickets.mockResolvedValue(0);
      await request(app).get(`/api/customers/${customer.id}/tickets`).set(auth(managerToken));
      const where = mocks.findTickets.mock.calls.at(-1)![0].where;
      expect(where.teamId).toBe(TEAM_A);
    });

    it("composes team scope with pagination", async () => {
      mocks.findCustomer.mockResolvedValue({ id: customer.id });
      mocks.findTickets.mockResolvedValue([
        { id: "ticket-2", subject: "Second", status: "OPEN", priority: "LOW", createdAt: now, updatedAt: now, assignedAgentId: null, category: null, assignedAgent: null },
      ]);
      mocks.countTickets.mockResolvedValue(2);
      const response = await request(app).get(`/api/customers/${customer.id}/tickets?page=2&limit=1`).set(auth(managerToken));
      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
      expect(mocks.findTickets).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: customer.id, teamId: TEAM_A }, skip: 1, take: 1 }));
    });
  });

  it("returns complete safe history to AGENT with server-derived access and pagination", async () => {
    mocks.findCustomer.mockResolvedValue({ id: customer.id });
    mocks.findTickets.mockResolvedValue([
      { id: "c737ce60fccf9da889f4605c0", subject: "Mine", status: "OPEN", priority: "HIGH", createdAt: now, updatedAt: now, assignedAgentId: "agent-1", category: { id: "category-1", name: "Billing" }, assignedAgent: { id: "agent-1", name: "Agent" } },
      { id: "ticket-2", subject: "Unassigned", status: "WAITING_CUSTOMER", priority: "MEDIUM", createdAt: now, updatedAt: now, assignedAgentId: null, category: null, assignedAgent: null },
      { id: "ticket-3", subject: "Other agent", status: "IN_PROGRESS", priority: "LOW", createdAt: now, updatedAt: now, assignedAgentId: "cc3544aa158a89417843d45b3", category: null, assignedAgent: { id: "cc3544aa158a89417843d45b3", name: "Other Agent" } },
    ]);
    mocks.countTickets.mockResolvedValue(23);
    const response = await request(app).get(`/api/customers/${customer.id}/tickets?page=2&limit=10`).set(auth(agentToken));
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 23, totalPages: 3 });
    expect(response.body.data.map((ticket: { access: string }) => ticket.access)).toEqual(["FULL", "FULL", "SUMMARY_ONLY"]);
    expect(response.body.data[2]).toEqual({ id: "ticket-3", subject: "Other agent", status: "IN_PROGRESS", priority: "LOW", createdAt: now.toISOString(), updatedAt: now.toISOString(), category: null, assignedAgent: { id: "cc3544aa158a89417843d45b3", name: "Other Agent" }, access: "SUMMARY_ONLY" });
    expect(response.body.data[2]).not.toHaveProperty("assignedAgentId");
  });

  it("rejects unauthenticated/CUSTOMER history access and returns customer not found", async () => {
    expect((await request(app).get(`/api/customers/${customer.id}/tickets`)).status).toBe(401);
    expect((await request(app).get(`/api/customers/${customer.id}/tickets`).set(auth(customerToken))).status).toBe(403);
    mocks.findCustomer.mockResolvedValue(null);
    const missing = await request(app).get("/api/customers/cffa63583dfa6706b87d284b8/tickets").set(auth(agentToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it.each([
    ["create", "post", "/api/customers", { name: "Agent Write", email: "agent-write@example.com" }],
    ["update", "patch", `/api/customers/${customer.id}`, { name: "Agent Write" }],
    ["delete", "delete", `/api/customers/${customer.id}`, undefined],
    ["add note", "post", `/api/customers/${customer.id}/notes`, { body: "Forbidden note" }],
  ] as const)("returns structured 403 when AGENT attempts to %s", async (_label, method, path, body) => {
    const call = request(app)[method](path).set(auth(agentToken));
    const response = body ? await call.send(body) : await call;
    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken]])("keeps %s customer mutations available", async (_role, token) => {
    mocks.findCustomer.mockResolvedValue(null);
    mocks.createCustomer.mockResolvedValue(customer);
    const response = await request(app).post("/api/customers").set(auth(token)).send({ name: customer.name, email: customer.email });
    expect(response.status).toBe(201);
  });

  it("lists customers with pagination, search, and real ticket counts", async () => {
    mocks.findMany.mockResolvedValue([{ ...customer, tickets: [{ updatedAt: now }], _count: { tickets: 3 } }]);
    mocks.countCustomers.mockResolvedValue(1);
    mocks.groupTickets.mockResolvedValue([{ customerId: customer.id, _count: { _all: 2 } }]);

    const response = await request(app).get("/api/customers?search=Ahmed&page=1&limit=10").set(auth());
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ openTicketCount: 2, totalTicketCount: 3 });
    expect(response.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: expect.arrayContaining([{ name: { contains: "Ahmed", mode: "insensitive" } }]) },
      skip: 0, take: 10,
    }));
  });

  it("creates a normalized customer without a login identity", async () => {
    mocks.findFirstCustomer.mockResolvedValue(null);
    mocks.createCustomer.mockResolvedValue(customer);
    const response = await request(app).post("/api/customers").set(auth()).send({
      name: "  Ahmed Mohamed ", email: " AHMED@Example.com ", phone: "+14155552671",
    });
    expect(response.status).toBe(201);
    expect(mocks.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+14155552671", userId: null },
    }));
  });

  it("returns a conflict for a duplicate customer email, matched case-insensitively", async () => {
    mocks.findFirstCustomer.mockResolvedValue({ id: "existing" });
    const response = await request(app).post("/api/customers").set(auth()).send({
      name: "Ahmed Mohamed", email: "ahmed@example.com",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_EMAIL_EXISTS");
    expect(mocks.createCustomer).not.toHaveBeenCalled();
    expect(mocks.findFirstCustomer).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "ahmed@example.com", mode: "insensitive" } },
    }));
  });

  it("returns a conflict for a case-variant duplicate customer email on update", async () => {
    mocks.findFirstCustomer.mockResolvedValue({ id: "other-customer" });
    const response = await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({
      email: "Ahmed@Example.com",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_EMAIL_EXISTS");
    expect(mocks.updateCustomer).not.toHaveBeenCalled();
    expect(mocks.findFirstCustomer).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "ahmed@example.com", mode: "insensitive" }, NOT: { id: customer.id } },
    }));
  });

  it("maps a raced case-variant duplicate email to 409 on create when the app pre-check misses it (CUST-FOLLOWUP-001)", async () => {
    // Simulates two concurrent creates both passing the findFirst pre-check before either
    // commits. The DB-level functional unique index on LOWER(email) is the final authority:
    // the losing create's Prisma call rejects with P2002 (verified against the real dev
    // Postgres index "Customer_email_lower_key", meta.target: ["lower(email)"]), and the
    // existing P2002 catch must still map it to 409 CUSTOMER_EMAIL_EXISTS.
    mocks.findFirstCustomer.mockResolvedValue(null);
    mocks.createCustomer.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002", clientVersion: "6", meta: { modelName: "Customer", target: ["lower(email)"] },
      }),
    );
    const response = await request(app).post("/api/customers").set(auth()).send({
      name: "Ahmed Mohamed", email: "ahmed@example.com",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_EMAIL_EXISTS");
  });

  it("maps a raced case-variant duplicate email to 409 on update when the app pre-check misses it (CUST-FOLLOWUP-001)", async () => {
    mocks.findFirstCustomer.mockResolvedValue(null);
    mocks.findCustomer.mockResolvedValue(customer);
    mocks.updateCustomer.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002", clientVersion: "6", meta: { modelName: "Customer", target: ["lower(email)"] },
      }),
    );
    const response = await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({
      email: "Ahmed@Example.com",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_EMAIL_EXISTS");
  });

  it("does not conflict when a customer re-submits its own email on update", async () => {
    mocks.findFirstCustomer.mockResolvedValue(null);
    mocks.findCustomer.mockResolvedValue(customer);
    mocks.updateCustomer.mockResolvedValue(customer);
    const response = await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({
      email: "Ahmed@Example.com",
    });
    expect(response.status).toBe(200);
    expect(mocks.findFirstCustomer).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "ahmed@example.com", mode: "insensitive" }, NOT: { id: customer.id } },
    }));
  });

  it("returns customer details without sensitive identity fields", async () => {
    mocks.findCustomer.mockResolvedValue({ ...customer, user: { id: "user-1", name: customer.name, email: customer.email, role: "CUSTOMER" }, attachments: [], tickets: [], _count: { tickets: 0 } });
    const response = await request(app).get(`/api/customers/${customer.id}`).set(auth());
    expect(response.status).toBe(200);
    expect(response.body.data.supportSummary).toMatchObject({ openTicketCount: 0, totalTicketCount: 0 });
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("returns not found for a missing customer", async () => {
    mocks.findCustomer.mockResolvedValue(null);
    const response = await request(app).get("/api/customers/cffa63583dfa6706b87d284b8").set(auth());
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("updates only normalized profile fields", async () => {
    mocks.findCustomer.mockResolvedValue(customer);
    mocks.updateCustomer.mockResolvedValue({ ...customer, email: "new@example.com" });
    const response = await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({ email: " NEW@Example.com " });
    expect(response.status).toBe(200);
    expect(mocks.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({ data: { email: "new@example.com" } }));

    await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({ phone: "" });
    expect(mocks.updateCustomer).toHaveBeenLastCalledWith(expect.objectContaining({ data: { phone: null } }));
  });

  it("creates an internal note using the authenticated user as author", async () => {
    mocks.findCustomer.mockResolvedValue({ id: customer.id });
    mocks.createNote.mockResolvedValue({ id: "cea503d892f34f0298079b79d", body: "Prefers phone", createdAt: now, author: { id: "admin-1", name: "Admin", role: "ADMIN" } });
    const response = await request(app).post(`/api/customers/${customer.id}/notes`).set(auth()).send({ body: " Prefers phone " });
    expect(response.status).toBe(201);
    expect(mocks.createNote).toHaveBeenCalledWith(expect.objectContaining({ data: { customerId: customer.id, authorUserId: "admin-1", body: "Prefers phone" } }));
  });

  it("refuses to delete a customer with support history", async () => {
    mocks.findCustomer.mockResolvedValue({ userId: null, _count: { tickets: 1, feedback: 0, notes: 0, attachments: 0 } });
    const response = await request(app).delete(`/api/customers/${customer.id}`).set(auth());
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_HAS_SUPPORT_HISTORY");
    expect(mocks.deleteCustomer).not.toHaveBeenCalled();
  });

  it("deletes an unlinked customer without support history", async () => {
    mocks.findCustomer.mockResolvedValue({ userId: null, _count: { tickets: 0, feedback: 0, notes: 0, attachments: 0 } });
    mocks.deleteCustomer.mockResolvedValue(customer);
    const response = await request(app).delete(`/api/customers/${customer.id}`).set(auth());
    expect(response.status).toBe(204);
    expect(mocks.deleteCustomer).toHaveBeenCalledWith({ where: { id: customer.id } });
  });
});
