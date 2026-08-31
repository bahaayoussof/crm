import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const branch = {
    findMany: mocks.findMany,
    count: mocks.count,
    findUnique: mocks.findUnique,
    findFirst: mocks.findFirst,
    create: mocks.create,
    update: mocks.update,
    delete: mocks.remove,
  };
  const auditLog = { create: mocks.auditCreate };
  return {
    prisma: {
      user: { findUnique: mocks.user },
      branch,
      auditLog,
      $transaction: vi.fn(async (value: unknown) =>
        typeof value === "function"
          ? (value as (tx: unknown) => unknown)({ branch, auditLog })
          : Promise.all(value as Promise<unknown>[])),
    },
  };
});

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (role: Role, id = role.toLowerCase()) => createAccessToken({ id, role });
const auth = (role: Role) => ({ Authorization: `Bearer ${token(role)}` });

const row = {
  id: "b1",
  name: "Head Office",
  code: "HQ",
  address: null,
  isActive: true,
  _count: { departments: 0, users: 0, tickets: 0 },
  createdAt: new Date("2026-08-30T00:00:00.000Z"),
  updatedAt: new Date("2026-08-30T00:00:00.000Z"),
};

describe("branches API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ role: where.id.toUpperCase() as Role, isActive: true }),
    );
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.findFirst.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockResolvedValue(row);
    mocks.update.mockResolvedValue(row);
    mocks.remove.mockResolvedValue(row);
  });

  it("requires authentication for the admin surface", async () => {
    expect((await request(app).get("/api/settings/branches")).status).toBe(401);
    expect((await request(app).post("/api/settings/branches").send({ name: "X" })).status).toBe(401);
  });

  it.each([Role.MANAGER, Role.AGENT, Role.CUSTOMER])("rejects %s from admin CRUD", async (role) => {
    expect((await request(app).get("/api/settings/branches").set(auth(role))).status).toBe(403);
    expect((await request(app).delete("/api/settings/branches/b1").set(auth(role))).status).toBe(403);
  });

  it("lists branches with a name/code search for ADMIN", async () => {
    mocks.findMany.mockResolvedValue([row]);
    mocks.count.mockResolvedValue(1);
    const response = await request(app).get("/api/settings/branches?search=hq").set(auth(Role.ADMIN));
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toMatchObject({ id: "b1", departmentCount: 0, userCount: 0, ticketCount: 0 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "hq", mode: "insensitive" } },
            { code: { contains: "hq", mode: "insensitive" } },
          ],
        },
      }),
    );
  });

  it("creates and trims a branch", async () => {
    const response = await request(app)
      .post("/api/settings/branches")
      .set(auth(Role.ADMIN))
      .send({ name: "  Head Office  ", code: "  HQ ", address: "  1 Main St " });
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Head Office", code: "HQ", address: "1 Main St" }),
      }),
    );
  });

  it("rejects a duplicate branch name", async () => {
    mocks.findFirst.mockResolvedValue({ id: "other" });
    const response = await request(app).post("/api/settings/branches").set(auth(Role.ADMIN)).send({ name: "Head Office" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BRANCH_NAME_ALREADY_EXISTS");
  });

  it.each([{ name: "" }, { name: "x" }, { name: "ok", unknown: true }])(
    "rejects invalid create input %j",
    async (body) => {
      expect((await request(app).post("/api/settings/branches").set(auth(Role.ADMIN)).send(body)).status).toBe(400);
    },
  );

  it("returns 404 when updating a missing branch", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).patch("/api/settings/branches/missing").set(auth(Role.ADMIN)).send({ name: "New" });
    expect(response.status).toBe(404);
  });

  it("deactivates a branch without deleting it", async () => {
    mocks.findUnique.mockResolvedValue({ id: "b1", name: "Head Office", code: "HQ", address: null, isActive: true });
    mocks.update.mockResolvedValue({ ...row, isActive: false });
    const response = await request(app).patch("/api/settings/branches/b1").set(auth(Role.ADMIN)).send({ isActive: false });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "BRANCH_DEACTIVATED" }) }),
    );
  });

  it("blocks deletion while the branch is still referenced (409 CONFLICT)", async () => {
    mocks.findUnique.mockResolvedValue({ id: "b1", name: "Head Office", _count: { departments: 2, users: 1, tickets: 0 } });
    const response = await request(app).delete("/api/settings/branches/b1").set(auth(Role.ADMIN));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("BRANCH_IN_USE");
    expect(response.body.error.details).toMatchObject({ departments: 2, users: 1, tickets: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced branch", async () => {
    mocks.findUnique.mockResolvedValue({ id: "b1", name: "Head Office", _count: { departments: 0, users: 0, tickets: 0 } });
    const response = await request(app).delete("/api/settings/branches/b1").set(auth(Role.ADMIN));
    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "b1" } });
  });

  it("exposes an active-only lookup to every internal role", async () => {
    mocks.findMany.mockResolvedValue([{ id: "b1", name: "Head Office", code: "HQ" }]);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).get("/api/branches").set(auth(role))).status).toBe(200);
    }
    expect((await request(app).get("/api/branches").set(auth(Role.CUSTOMER))).status).toBe(403);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
  });
});
