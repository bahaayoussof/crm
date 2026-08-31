import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factory
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  notificationCount: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationFindUnique: vi.fn(),
  notificationUpdate: vi.fn(),
  notificationUpdateMany: vi.fn(),
  notificationCreateMany: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, findMany: mocks.userFindMany },
    notification: {
      findMany: mocks.notificationFindMany,
      count: mocks.notificationCount,
      findFirst: mocks.notificationFindFirst,
      findUnique: mocks.notificationFindUnique,
      update: mocks.notificationUpdate,
      updateMany: mocks.notificationUpdateMany,
      createMany: mocks.notificationCreateMany,
    },
    $transaction: mocks.$transaction,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (role: Role, id = role.toLowerCase()) => createAccessToken({ id, role });
const auth = (role: Role, id?: string) => ({ Authorization: `Bearer ${token(role, id)}` });

const notification = (overrides = {}) => ({
  id: "c676b8bb84ce7267dd520deca",
  type: "TICKET_ASSIGNED",
  title: "New ticket assigned",
  message: "You have been assigned ticket #t1",
  ticketId: "t1",
  readAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("notifications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // requireAuth runs; then requireRole; requireActiveUser is not wired on notification routes
    mocks.userFindUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ role: where.id.toUpperCase() as Role, isActive: true }),
    );
    // Default list mock
    mocks.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") return arg({});
      if (Array.isArray(arg)) return Promise.all(arg);
      return arg;
    });
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.notificationCount.mockResolvedValue(0);
  });

  it("rejects a malformed notification id before database lookup", async () => {
    const response = await request(app)
      .patch("/api/notifications/not-a-cuid/read")
      .set(auth(Role.AGENT));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.notificationFindFirst).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Auth & role guards
  // ---------------------------------------------------------------------------
  describe("authentication", () => {
    it("rejects unauthenticated GET /", async () => {
      expect((await request(app).get("/api/notifications")).status).toBe(401);
    });
    it("rejects unauthenticated GET /unread-count", async () => {
      expect((await request(app).get("/api/notifications/unread-count")).status).toBe(401);
    });
    it("rejects CUSTOMER role on all endpoints", async () => {
      expect((await request(app).get("/api/notifications").set(auth(Role.CUSTOMER))).status).toBe(403);
      expect((await request(app).get("/api/notifications/unread-count").set(auth(Role.CUSTOMER))).status).toBe(403);
      expect((await request(app).patch("/api/notifications/read-all").set(auth(Role.CUSTOMER))).status).toBe(403);
      expect((await request(app).patch("/api/notifications/c676b8bb84ce7267dd520deca/read").set(auth(Role.CUSTOMER))).status).toBe(403);
    });
    it.each([Role.ADMIN, Role.MANAGER, Role.AGENT])("allows %s on GET /", async (role) => {
      expect((await request(app).get("/api/notifications").set(auth(role))).status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // GET / — list
  // ---------------------------------------------------------------------------
  describe("GET /", () => {
    it("returns paginated notifications newest first", async () => {
      mocks.notificationFindMany.mockResolvedValue([notification()]);
      mocks.notificationCount.mockResolvedValue(1);
      const res = await request(app).get("/api/notifications").set(auth(Role.AGENT));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it("filters by read=false (unread)", async () => {
      await request(app).get("/api/notifications?read=false").set(auth(Role.AGENT));
      expect(mocks.notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ readAt: null }) }),
      );
    });

    it("filters by read=true (read)", async () => {
      await request(app).get("/api/notifications?read=true").set(auth(Role.AGENT));
      expect(mocks.notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ readAt: { not: null } }) }),
      );
    });

    it("rejects unknown query fields", async () => {
      expect((await request(app).get("/api/notifications?unknown=1").set(auth(Role.AGENT))).status).toBe(400);
    });

    it("rejects limit > 50", async () => {
      expect((await request(app).get("/api/notifications?limit=51").set(auth(Role.AGENT))).status).toBe(400);
    });

    it("scopes results to authenticated user", async () => {
      await request(app).get("/api/notifications").set(auth(Role.AGENT, "c91b175c653e7092153533892"));
      expect(mocks.notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: "c91b175c653e7092153533892" }) }),
      );
    });

    it("orders createdAt DESC id ASC", async () => {
      await request(app).get("/api/notifications").set(auth(Role.AGENT));
      expect(mocks.notificationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // GET /unread-count
  // ---------------------------------------------------------------------------
  describe("GET /unread-count", () => {
    it("returns count of unread notifications", async () => {
      mocks.notificationCount.mockResolvedValue(3);
      const res = await request(app).get("/api/notifications/unread-count").set(auth(Role.AGENT));
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
    });

    it("scopes count to authenticated user", async () => {
      mocks.notificationCount.mockResolvedValue(0);
      await request(app).get("/api/notifications/unread-count").set(auth(Role.AGENT, "agent-99"));
      expect(mocks.notificationCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "agent-99", readAt: null } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /read-all — must be registered before /:id
  // ---------------------------------------------------------------------------
  describe("PATCH /read-all", () => {
    it("marks all unread as read for authenticated user", async () => {
      mocks.notificationUpdateMany.mockResolvedValue({ count: 5 });
      const res = await request(app).patch("/api/notifications/read-all").set(auth(Role.ADMIN));
      expect(res.status).toBe(200);
      expect(res.body.data.updated).toBe(5);
    });

    it("scopes updateMany to the current user", async () => {
      mocks.notificationUpdateMany.mockResolvedValue({ count: 0 });
      await request(app).patch("/api/notifications/read-all").set(auth(Role.AGENT, "ccfad431af89dd48c0fe73ace"));
      expect(mocks.notificationUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "ccfad431af89dd48c0fe73ace", readAt: null } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /:id/read
  // ---------------------------------------------------------------------------
  describe("PATCH /:id/read", () => {
    it("marks a notification read and returns it", async () => {
      mocks.notificationFindFirst.mockResolvedValue({ id: "c676b8bb84ce7267dd520deca", readAt: null });
      mocks.notificationUpdate.mockResolvedValue(notification({ readAt: new Date().toISOString() }));
      const res = await request(app).patch("/api/notifications/c676b8bb84ce7267dd520deca/read").set(auth(Role.AGENT));
      expect(res.status).toBe(200);
      expect(res.body.data.readAt).not.toBeNull();
    });

    it("is idempotent — already-read notification returns without update", async () => {
      const readAt = new Date().toISOString();
      mocks.notificationFindFirst.mockResolvedValue({ id: "c676b8bb84ce7267dd520deca", readAt });
      mocks.notificationFindUnique.mockResolvedValue(notification({ readAt }));
      const res = await request(app).patch("/api/notifications/c676b8bb84ce7267dd520deca/read").set(auth(Role.AGENT));
      expect(res.status).toBe(200);
      expect(mocks.notificationUpdate).not.toHaveBeenCalled();
    });

    it("returns 404 NOTIFICATION_NOT_FOUND for unknown id", async () => {
      mocks.notificationFindFirst.mockResolvedValue(null);
      const res = await request(app).patch("/api/notifications/cffa63583dfa6706b87d284b8/read").set(auth(Role.AGENT));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    });

    it("returns same 404 for wrong-owner (ownership isolation)", async () => {
      // findFirst with userId filter returns null — indistinguishable from missing
      mocks.notificationFindFirst.mockResolvedValue(null);
      const res = await request(app).patch("/api/notifications/c00bbd99c60ddfafec39f3447/read").set(auth(Role.AGENT, "agent-X"));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOTIFICATION_NOT_FOUND");
    });
  });
});

// ---------------------------------------------------------------------------
// createNotifications unit tests
// ---------------------------------------------------------------------------
describe("createNotifications (service unit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deduplicates recipients before insertion", async () => {
    const { createNotifications } = await import("./notification.service.js");
    const txMock = { notification: { createMany: vi.fn().mockResolvedValue({ count: 2 }) } };
    await createNotifications(txMock as never, ["u1", "u2", "u1"], "TYPE", "T", "M", "ticket-1");
    expect(txMock.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ userId: "u1" }), expect.objectContaining({ userId: "u2" })]) }),
    );
    const { data } = txMock.notification.createMany.mock.calls[0][0] as { data: { userId: string }[] };
    const ids = data.map((d) => d.userId);
    expect(ids).toEqual(["u1", "u2"]); // deduplicated
  });

  it("does nothing when recipient list is empty", async () => {
    const { createNotifications } = await import("./notification.service.js");
    const txMock = { notification: { createMany: vi.fn() } };
    await createNotifications(txMock as never, [], "TYPE", "T", "M", "ticket-1");
    expect(txMock.notification.createMany).not.toHaveBeenCalled();
  });

  it("stores ticketId on each notification", async () => {
    const { createNotifications } = await import("./notification.service.js");
    const txMock = { notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) } };
    await createNotifications(txMock as never, ["u1"], "TICKET_ASSIGNED", "T", "M", "c58b8266464b0337e1a1366f4");
    const { data } = txMock.notification.createMany.mock.calls[0][0] as { data: { ticketId: string }[] };
    expect(data[0]?.ticketId).toBe("c58b8266464b0337e1a1366f4");
  });
});
