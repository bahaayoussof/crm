import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock("../../config/prisma.js", () => ({ prisma: { auditLog: { findMany: mocks.findMany, count: mocks.count }, $transaction: vi.fn(async (items: Promise<unknown>[]) => Promise.all(items)) } }));
import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";
const auth = (role: Role) => ({ Authorization: `Bearer ${createAccessToken({ id: role.toLowerCase(), role })}` });

describe("audit log API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0); });
  it("allows ADMIN and rejects every other audience", async () => {
    expect((await request(app).get("/api/audit-logs").set(auth(Role.ADMIN))).status).toBe(200);
    for (const role of [Role.MANAGER, Role.AGENT, Role.CUSTOMER]) expect((await request(app).get("/api/audit-logs").set(auth(role))).status).toBe(403);
    expect((await request(app).get("/api/audit-logs")).status).toBe(401);
  });
  it("applies safe filters, deterministic ordering, and pagination", async () => {
    await request(app).get("/api/audit-logs?page=2&limit=10&search=agent&actorId=u1&action=USER_UPDATED&entityType=USER&entityId=u2&from=2026-01-01T00:00:00.000Z&to=2026-02-01T00:00:00.000Z").set(auth(Role.ADMIN));
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }], where: expect.objectContaining({ actorId: "u1", action: "USER_UPDATED", entityType: "USER", entityId: "u2" }) }));
  });
  it("rejects invalid ranges and unknown query fields", async () => {
    expect((await request(app).get("/api/audit-logs?from=2026-02-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z").set(auth(Role.ADMIN))).status).toBe(400);
    expect((await request(app).get("/api/audit-logs?password=secret").set(auth(Role.ADMIN))).status).toBe(400);
  });
  it("projects changes separately and never returns actor credentials", async () => {
    mocks.findMany.mockResolvedValue([{ id: "a1", action: "USER_ROLE_CHANGED", entityType: "USER", entityId: "u2", metadata: { actorType: "USER", changes: { role: { from: "AGENT", to: "MANAGER" } }, source: "users" }, ipAddress: null, userAgent: null, createdAt: new Date(), actor: { id: "u1", name: "Admin", email: "admin@example.com" } }]); mocks.count.mockResolvedValue(1);
    const response = await request(app).get("/api/audit-logs").set(auth(Role.ADMIN));
    expect(response.body.data[0]).toMatchObject({ changes: { role: { from: "AGENT", to: "MANAGER" } }, metadata: { source: "users" }, actor: { id: "u1", name: "Admin", email: "admin@example.com" } });
    expect(JSON.stringify(response.body)).not.toMatch(/password|token|authorization/i);
  });
});
