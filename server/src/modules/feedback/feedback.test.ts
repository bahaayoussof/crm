import { Role, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { findUnique: vi.fn() },
  ticket: { findFirst: vi.fn() },
  feedback: { findUnique: vi.fn(), create: vi.fn() },
  ticketHistory: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ...mocks,
    $transaction: vi.fn(async (value: unknown) =>
      typeof value === "function" ? (value as (tx: typeof mocks) => unknown)(mocks) : Promise.all(value as Promise<unknown>[])),
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
const auth = (id: string, role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id, role })}` });
const post = (body: unknown) => request(app).post("/api/portal/tickets/ticket-a/feedback").set(auth("customer", Role.CUSTOMER)).send(body);

describe("customer feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
    mocks.customer.findUnique.mockResolvedValue({ id: "customer-a" });
    mocks.ticket.findFirst.mockResolvedValue({ id: "ticket-a", status: TicketStatus.RESOLVED });
    mocks.feedback.findUnique.mockResolvedValue(null);
    mocks.feedback.create.mockResolvedValue({ rating: 5, comment: "Great", createdAt: new Date() });
  });

  it("rejects unauthenticated and every internal role", async () => {
    expect((await request(app).post("/api/portal/tickets/ticket-a/feedback").send({ rating: 5 })).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).post("/api/portal/tickets/ticket-a/feedback").set(auth("staff", role)).send({ rating: 5 })).status).toBe(403);
    }
  });

  it("requires a linked customer profile", async () => {
    mocks.customer.findUnique.mockResolvedValue(null);
    const response = await post({ rating: 5 });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CUSTOMER_PROFILE_REQUIRED");
  });

  it("validates the rating range, integer, and rejects unknown fields", async () => {
    for (const rating of [0, 6, 2.5, "5"]) expect((await post({ rating })).status).toBe(400);
    expect((await post({ rating: 4, mood: "happy" })).status).toBe(400);
    expect((await post({ rating: 4, comment: "  " })).status).toBe(400);
  });

  it("returns IDOR-safe not found for a missing or non-owned ticket", async () => {
    mocks.ticket.findFirst.mockResolvedValue(null);
    const response = await post({ rating: 5 });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    expect(mocks.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ticket-a", customerId: "customer-a" } }));
  });

  it("rejects feedback for tickets that are not resolved or closed", async () => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "ticket-a", status: TicketStatus.IN_PROGRESS });
    const response = await post({ rating: 5 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TICKET_NOT_ELIGIBLE_FOR_FEEDBACK");
    expect(mocks.feedback.create).not.toHaveBeenCalled();
  });

  it("allows exactly one feedback record per ticket", async () => {
    mocks.feedback.findUnique.mockResolvedValue({ id: "feedback-a" });
    const response = await post({ rating: 3 });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("FEEDBACK_ALREADY_SUBMITTED");
    expect(mocks.feedback.create).not.toHaveBeenCalled();
  });

  it.each([TicketStatus.RESOLVED, TicketStatus.CLOSED])("records feedback plus a history entry for a %s ticket", async (status) => {
    mocks.ticket.findFirst.mockResolvedValue({ id: "ticket-a", status });
    const response = await post({ rating: 5, comment: "  Great support  " });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ rating: 5, comment: "Great", createdAt: expect.any(String) });
    expect(mocks.feedback.create.mock.calls[0][0].data).toMatchObject({ ticketId: "ticket-a", customerId: "customer-a", rating: 5, comment: "Great support" });
    expect(mocks.ticketHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ticketId: "ticket-a", actorUserId: "customer", action: "FEEDBACK_SUBMITTED", newValue: "5" }) });
  });

  it("stores a null comment when none is provided", async () => {
    mocks.feedback.create.mockResolvedValue({ rating: 4, comment: null, createdAt: new Date() });
    const response = await post({ rating: 4 });
    expect(response.status).toBe(201);
    expect(mocks.feedback.create.mock.calls[0][0].data.comment).toBeNull();
  });

  it("reads back submitted feedback and 404s when none exists", async () => {
    mocks.feedback.findUnique.mockResolvedValueOnce(null);
    const missing = await request(app).get("/api/portal/tickets/ticket-a/feedback").set(auth("customer", Role.CUSTOMER));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("FEEDBACK_NOT_FOUND");
    mocks.feedback.findUnique.mockResolvedValueOnce({ rating: 2, comment: null, createdAt: new Date() });
    const found = await request(app).get("/api/portal/tickets/ticket-a/feedback").set(auth("customer", Role.CUSTOMER));
    expect(found.status).toBe(200);
    expect(found.body.data).toEqual({ rating: 2, comment: null, createdAt: expect.any(String) });
  });
});
