import { Role, TicketStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  customer: { findUnique: vi.fn() },
  department: { findUnique: vi.fn(), findMany: vi.fn() },
  team: { findFirst: vi.fn() },
  ticket: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  ticketHistory: { create: vi.fn().mockResolvedValue({}) },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
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
const DEPT_ID = "cdep111111111111111111111";
const TEAM_ID = "cteam11111111111111111111";
const BRANCH_ID = "cbr1111111111111111111111";

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

/** Wire the happy-path create: no resumable chat, active department + team. */
function arrangeCreate() {
  mocks.ticket.findFirst
    .mockResolvedValueOnce(null) // resumable lookup
    .mockResolvedValueOnce(detailRow(TicketStatus.OPEN)); // ticketDetail after create
  mocks.department.findUnique.mockResolvedValue({ id: DEPT_ID, isActive: true, branchId: BRANCH_ID });
  mocks.team.findFirst.mockResolvedValue({ id: TEAM_ID });
  mocks.ticket.create.mockResolvedValue({ id: CHAT_ID, customerId: CUSTOMER_ID, teamId: TEAM_ID });
}

const startBody = { departmentId: DEPT_ID };

describe("portal live chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID });
    mocks.slaRule.findFirst.mockResolvedValue({ firstResponseMinutes: 30, resolutionMinutes: 120 });
    mocks.user.findUnique.mockResolvedValue({ passwordChangedAt: null });
  });

  it("rejects the anonymous caller and every internal role", async () => {
    expect((await request(app).get("/api/portal/live-chat")).status).toBe(401);
    expect((await request(app).get("/api/portal/live-chat/departments")).status).toBe(401);
    expect((await request(app).post("/api/portal/live-chat")).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).get("/api/portal/live-chat").set(auth("staff", role))).status).toBe(403);
      expect((await request(app).get("/api/portal/live-chat/departments").set(auth("staff", role))).status).toBe(403);
      expect((await request(app).post("/api/portal/live-chat").set(auth("staff", role))).status).toBe(403);
    }
  });

  it("requires a linked customer profile", async () => {
    mocks.customer.findUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CUSTOMER_PROFILE_REQUIRED");
  });

  // --- Department selector endpoint -----------------------------------------

  it("GET /departments returns only active departments that have an active team, id + name only", async () => {
    mocks.department.findMany.mockResolvedValue([
      { id: DEPT_ID, name: "Billing" },
      { id: "cdep222222222222222222222", name: "Support" },
    ]);
    const response = await request(app)
      .get("/api/portal/live-chat/departments")
      .set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { id: DEPT_ID, name: "Billing" },
      { id: "cdep222222222222222222222", name: "Support" },
    ]);
    // server-enforced filter: active department AND at least one active team
    expect(mocks.department.findMany).toHaveBeenCalledWith({
      where: { isActive: true, teams: { some: { isActive: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    // no internal metadata in the projection
    const select = mocks.department.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("branchId");
    expect(select).not.toHaveProperty("managerId");
    expect(select).not.toHaveProperty("_count");
  });

  // --- Resume ---------------------------------------------------------------

  it("GET returns null when the customer has no resumable live chat", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
    const where = mocks.ticket.findFirst.mock.calls[0][0].where;
    expect(where.customerId).toBe(CUSTOMER_ID);
    expect(where.channel).toBe("LIVE_CHAT");
    expect(where.status.in).toEqual(expect.arrayContaining([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED]));
    expect(where.status.in).not.toContain(TicketStatus.RESOLVED);
    expect(where.status.in).not.toContain(TicketStatus.CLOSED);
  });

  it("GET resumes the most recent non-terminal live chat", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID })
      .mockResolvedValueOnce(detailRow(TicketStatus.IN_PROGRESS));
    const response = await request(app).get("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(response.body.data.status).toBe("IN_PROGRESS");
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(mocks.ticket.findFirst.mock.calls[0][0].orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });

  it("POST resumes an existing chat without re-routing it — department/team are never touched", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup hits
      .mockResolvedValueOnce(detailRow(TicketStatus.IN_PROGRESS)); // ticketDetail
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    // resume short-circuits BEFORE any routing work
    expect(mocks.department.findUnique).not.toHaveBeenCalled();
    expect(mocks.team.findFirst).not.toHaveBeenCalled();
    expect(mocks.ticket.findFirst).toHaveBeenCalledTimes(2);
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  // --- Create: routing by selected Department ------------------------------

  it("POST creates a LIVE_CHAT ticket scoped to the selected Department + resolved Team", async () => {
    arrangeCreate();
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);

    const data = mocks.ticket.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      customerId: CUSTOMER_ID,
      status: "OPEN",
      priority: "MEDIUM",
      channel: "LIVE_CHAT",
      assignedAgentId: null,
      categoryId: null,
      departmentId: DEPT_ID,
      teamId: TEAM_ID,
      branchId: BRANCH_ID,
    });
    expect(data.firstResponseDueAt).toBeInstanceOf(Date);
    expect(data.resolutionDueAt).toBeInstanceOf(Date);
    expect(mocks.ticketHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorUserId: "customer", action: "TICKET_CREATED" }) });
    // first + only realtime event already carries the resolved teamId
    expect(emitUpdated).toHaveBeenCalledTimes(1);
    expect(emitUpdated).toHaveBeenCalledWith(expect.objectContaining({ ticketId: CHAT_ID, assignedAgentId: null, teamId: TEAM_ID }));
    expect(mocks.ticket.create).toHaveBeenCalledTimes(1);
  });

  it("resolves the Team only within the selected Department, deterministically oldest-first", async () => {
    arrangeCreate();
    await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send(startBody);
    expect(mocks.team.findFirst).toHaveBeenCalledWith({
      where: { departmentId: DEPT_ID, isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  it("does NOT consult the customer's ticket history for routing (heuristic removed)", async () => {
    arrangeCreate();
    await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send(startBody);
    // exactly two ticket.findFirst calls: the resumable lookup + ticketDetail.
    // No third "most recent routed ticket" lookup.
    expect(mocks.ticket.findFirst).toHaveBeenCalledTimes(2);
    for (const call of mocks.ticket.findFirst.mock.calls) {
      expect(call[0].where).not.toHaveProperty("teamId");
    }
    expect(liveChatInternals).not.toHaveProperty("resolveLiveChatTeamId");
  });

  it("persists branchId as null when the Department has no branch", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(detailRow());
    mocks.department.findUnique.mockResolvedValue({ id: DEPT_ID, isActive: true, branchId: null });
    mocks.team.findFirst.mockResolvedValue({ id: TEAM_ID });
    mocks.ticket.create.mockResolvedValue({ id: CHAT_ID, customerId: CUSTOMER_ID, teamId: TEAM_ID });
    await request(app).post("/api/portal/live-chat").set(auth("customer", Role.CUSTOMER)).send(startBody);
    expect(mocks.ticket.create.mock.calls[0][0].data.branchId).toBeNull();
  });

  // --- Invalid routing ----------------------------------------------------

  it("rejects an unknown Department with 404 and creates nothing", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    mocks.department.findUnique.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("DEPARTMENT_NOT_FOUND");
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("rejects an inactive Department and creates nothing", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    mocks.department.findUnique.mockResolvedValue({ id: DEPT_ID, isActive: false, branchId: BRANCH_ID });
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DEPARTMENT_INACTIVE");
    expect(mocks.ticket.create).not.toHaveBeenCalled();
  });

  it("returns a customer-safe 'unavailable' error when the Department has no active Team, and creates nothing", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    mocks.department.findUnique.mockResolvedValue({ id: DEPT_ID, isActive: true, branchId: BRANCH_ID });
    mocks.team.findFirst.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("LIVE_CHAT_DEPARTMENT_UNAVAILABLE");
    // no internal team configuration leaked
    expect(JSON.stringify(response.body)).not.toMatch(/team/i);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  // --- Strict input ------------------------------------------------------

  it("rejects a malformed departmentId or any server-controlled field", async () => {
    for (const body of [
      { departmentId: "not-a-cuid" },
      { departmentId: DEPT_ID, customerId: "cd9298a10d1b0735837dc4bd8" },
      { departmentId: DEPT_ID, teamId: TEAM_ID },
      { departmentId: DEPT_ID, channel: "WEB" },
      { departmentId: DEPT_ID, status: "CLOSED" },
      { departmentId: DEPT_ID, priority: "HIGH" },
      { departmentId: DEPT_ID, assignedAgentId: "x" },
    ]) {
      const response = await request(app)
        .post("/api/portal/live-chat")
        .set(auth("customer", Role.CUSTOMER))
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(mocks.ticket.create).not.toHaveBeenCalled();
  });

  it("rejects a create with no departmentId (DEPARTMENT_REQUIRED) and creates nothing", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null); // no resumable chat
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("DEPARTMENT_REQUIRED");
    expect(mocks.ticket.create).not.toHaveBeenCalled();
  });

  it("POST with no body resumes an existing chat (departmentId not required to resume)", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup hits
      .mockResolvedValueOnce(detailRow(TicketStatus.IN_PROGRESS)); // ticketDetail
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send({});
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(mocks.department.findUnique).not.toHaveBeenCalled();
  });

  it("forces channel = LIVE_CHAT server-side regardless of input", async () => {
    arrangeCreate();
    await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(mocks.ticket.create.mock.calls[0][0].data.channel).toBe("LIVE_CHAT");
  });

  it("derives the customer strictly from auth, not from any input", async () => {
    mocks.customer.findUnique.mockResolvedValue({ id: "c61b1436de3085c47167cb3c9" });
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    await request(app).get("/api/portal/live-chat").set(auth("cb9b8f9ca9e0d9e79cf06cef9", Role.CUSTOMER));
    expect(mocks.customer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "cb9b8f9ca9e0d9e79cf06cef9" } }));
    expect(mocks.ticket.findFirst.mock.calls[0][0].where.customerId).toBe("c61b1436de3085c47167cb3c9");
  });

  // --- Race safety -----------------------------------------------------

  it("does not create a duplicate when an active chat appears first (create-or-resume preserved)", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce({ id: CHAT_ID }) // resumable lookup wins the race
      .mockResolvedValueOnce(detailRow(TicketStatus.OPEN));
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(201);
    expect(response.body.data.id).toBe(CHAT_ID);
    expect(mocks.ticket.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("treats a RESOLVED/CLOSED live chat as terminal and starts a fresh routed one", async () => {
    arrangeCreate();
    const response = await request(app)
      .post("/api/portal/live-chat")
      .set(auth("customer", Role.CUSTOMER))
      .send(startBody);
    expect(response.status).toBe(201);
    expect(mocks.ticket.create).toHaveBeenCalledTimes(1);
    expect(mocks.ticket.create.mock.calls[0][0].data.teamId).toBe(TEAM_ID);
  });

  // --- Internal resolver -----------------------------------------------

  // --- Customer manual end -------------------------------------------------

  const ownedRow = (status: TicketStatus = TicketStatus.IN_PROGRESS) => ({
    id: CHAT_ID,
    status,
    channel: "LIVE_CHAT",
    assignedAgentId: null,
    teamId: TEAM_ID,
  });
  const endUrl = `/api/portal/live-chat/${CHAT_ID}/end`;

  it("lets the owning customer end an active LIVE_CHAT — transitions to RESOLVED with canonical fields", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(ownedRow(TicketStatus.IN_PROGRESS)) // ownership lookup
      .mockResolvedValueOnce(detailRow(TicketStatus.RESOLVED)); // ticketDetail
    mocks.ticket.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED");

    const update = mocks.ticket.updateMany.mock.calls[0][0];
    expect(update.where).toMatchObject({ id: CHAT_ID, customerId: CUSTOMER_ID, channel: "LIVE_CHAT" });
    expect(update.where.status.in).toEqual(
      expect.arrayContaining([TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED]),
    );
    expect(update.data.status).toBe("RESOLVED");
    expect(update.data.resolvedAt).toBeInstanceOf(Date);
    // routing / ownership fields are never touched by the transition
    expect(update.data).not.toHaveProperty("departmentId");
    expect(update.data).not.toHaveProperty("teamId");
    expect(update.data).not.toHaveProperty("assignedAgentId");
    expect(update.data).not.toHaveProperty("customerId");

    expect(mocks.ticketHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: CHAT_ID,
        actorUserId: "customer",
        action: "STATUS_CHANGED",
        newValue: TicketStatus.RESOLVED,
      }),
    });
    expect(mocks.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "TICKET_STATUS_CHANGED",
          entityId: CHAT_ID,
          metadata: expect.objectContaining({ reason: "live_chat_ended_by_customer" }),
        }),
      }),
    );
    expect(emitUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: CHAT_ID, teamId: TEAM_ID, customerId: CUSTOMER_ID }),
    );
  });

  it("rejects the anonymous caller and every internal role from ending a chat", async () => {
    expect((await request(app).post(endUrl)).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).post(endUrl).set(auth("staff", role))).status).toBe(403);
    }
    expect(mocks.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the ticket is not owned by the calling customer (cross-customer)", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(null);
    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    expect(mocks.ticket.updateMany).not.toHaveBeenCalled();
    // ownership is enforced in the query
    expect(mocks.ticket.findFirst.mock.calls[0][0].where).toMatchObject({ id: CHAT_ID, customerId: CUSTOMER_ID });
  });

  it("rejects a non-LIVE_CHAT ticket with 400 NOT_A_LIVE_CHAT and changes nothing", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce({ ...ownedRow(), channel: "WEB" });
    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("NOT_A_LIVE_CHAT");
    expect(mocks.ticket.updateMany).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("is idempotent when the chat is already RESOLVED — no second transition / history / audit / event", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(ownedRow(TicketStatus.RESOLVED))
      .mockResolvedValueOnce(detailRow(TicketStatus.RESOLVED));
    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED");
    expect(mocks.ticket.updateMany).not.toHaveBeenCalled();
    expect(mocks.ticketHistory.create).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("never reopens a CLOSED chat — 409 TICKET_CLOSED", async () => {
    mocks.ticket.findFirst.mockResolvedValueOnce(ownedRow(TicketStatus.CLOSED));
    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("TICKET_CLOSED");
    expect(mocks.ticket.updateMany).not.toHaveBeenCalled();
  });

  it("ignores any body fields — the server owns the transition (no status/teamId/customerId injection)", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(ownedRow(TicketStatus.OPEN))
      .mockResolvedValueOnce(detailRow(TicketStatus.RESOLVED));
    mocks.ticket.updateMany.mockResolvedValue({ count: 1 });
    const response = await request(app)
      .post(endUrl)
      .set(auth("customer", Role.CUSTOMER))
      .send({ status: "CLOSED", teamId: "cattacker1111111111111111", customerId: "cattacker2222222222222222" });
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("RESOLVED");
    expect(mocks.ticket.updateMany.mock.calls[0][0].data).toEqual({ status: "RESOLVED", resolvedAt: expect.any(Date) });
  });

  it("stays safe under a lost race — a concurrent resolve makes updateMany a no-op (count 0)", async () => {
    mocks.ticket.findFirst
      .mockResolvedValueOnce(ownedRow(TicketStatus.IN_PROGRESS))
      .mockResolvedValueOnce(detailRow(TicketStatus.RESOLVED));
    mocks.ticket.updateMany.mockResolvedValue({ count: 0 });
    const response = await request(app).post(endUrl).set(auth("customer", Role.CUSTOMER));
    expect(response.status).toBe(200);
    expect(mocks.ticketHistory.create).not.toHaveBeenCalled();
    expect(mocks.auditLog.create).not.toHaveBeenCalled();
    expect(emitUpdated).not.toHaveBeenCalled();
  });

  it("resolveLiveChatTeam returns the oldest active team + the department branch", async () => {
    const tx = {
      department: { findUnique: vi.fn().mockResolvedValue({ id: DEPT_ID, isActive: true, branchId: BRANCH_ID }) },
      team: { findFirst: vi.fn().mockResolvedValue({ id: TEAM_ID }) },
    };
    const result = await liveChatInternals.resolveLiveChatTeam(tx as never, DEPT_ID);
    expect(result).toEqual({ teamId: TEAM_ID, branchId: BRANCH_ID });
    expect(tx.team.findFirst).toHaveBeenCalledWith({
      where: { departmentId: DEPT_ID, isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });
});
