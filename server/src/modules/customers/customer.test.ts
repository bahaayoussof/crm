import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), countCustomers: vi.fn(), findCustomer: vi.fn(), createCustomer: vi.fn(),
  updateCustomer: vi.fn(), deleteCustomer: vi.fn(), transaction: vi.fn(),
  groupTickets: vi.fn(), countTickets: vi.fn(), findNotes: vi.fn(), createNote: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    customer: {
      findMany: mocks.findMany, count: mocks.countCustomers, findUnique: mocks.findCustomer,
      create: mocks.createCustomer, update: mocks.updateCustomer, delete: mocks.deleteCustomer,
    },
    ticket: { groupBy: mocks.groupTickets, count: mocks.countTickets },
    customerNote: { findMany: mocks.findNotes, create: mocks.createNote },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const adminToken = createAccessToken({ id: "admin-1", role: Role.ADMIN });
const customerToken = createAccessToken({ id: "portal-1", role: Role.CUSTOMER });
const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
const now = new Date("2026-08-24T12:00:00.000Z");
const customer = { id: "customer-1", name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+201000000000", createdAt: now, updatedAt: now };

describe("customer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.countCustomers.mockResolvedValue(0);
    mocks.transaction.mockImplementation(async (values: unknown[]) => Promise.all(values));
    mocks.groupTickets.mockResolvedValue([]);
    mocks.countTickets.mockResolvedValue(0);
    mocks.findNotes.mockResolvedValue([]);
  });

  it("rejects unauthenticated and CUSTOMER-role access", async () => {
    const unauthenticated = await request(app).get("/api/customers");
    const portalUser = await request(app).get("/api/customers").set(auth(customerToken));
    expect(unauthenticated.status).toBe(401);
    expect(portalUser.status).toBe(403);
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
    mocks.findCustomer.mockResolvedValue(null);
    mocks.createCustomer.mockResolvedValue(customer);
    const response = await request(app).post("/api/customers").set(auth()).send({
      name: "  Ahmed Mohamed ", email: " AHMED@Example.com ", phone: "+201000000000",
    });
    expect(response.status).toBe(201);
    expect(mocks.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: "Ahmed Mohamed", email: "ahmed@example.com", phone: "+201000000000", userId: null },
    }));
  });

  it("returns a conflict for a duplicate customer email", async () => {
    mocks.findCustomer.mockResolvedValue({ id: "existing" });
    const response = await request(app).post("/api/customers").set(auth()).send({
      name: "Ahmed Mohamed", email: "ahmed@example.com",
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CUSTOMER_EMAIL_EXISTS");
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
    const response = await request(app).get("/api/customers/missing").set(auth());
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("updates only normalized profile fields", async () => {
    mocks.updateCustomer.mockResolvedValue({ ...customer, email: "new@example.com" });
    const response = await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({ email: " NEW@Example.com " });
    expect(response.status).toBe(200);
    expect(mocks.updateCustomer).toHaveBeenCalledWith(expect.objectContaining({ data: { email: "new@example.com" } }));

    await request(app).patch(`/api/customers/${customer.id}`).set(auth()).send({ phone: "" });
    expect(mocks.updateCustomer).toHaveBeenLastCalledWith(expect.objectContaining({ data: { phone: null } }));
  });

  it("creates an internal note using the authenticated user as author", async () => {
    mocks.findCustomer.mockResolvedValue({ id: customer.id });
    mocks.createNote.mockResolvedValue({ id: "note-1", body: "Prefers phone", createdAt: now, author: { id: "admin-1", name: "Admin", role: "ADMIN" } });
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
