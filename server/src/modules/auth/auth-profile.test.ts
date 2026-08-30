import { Prisma, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  customerFindFirst: vi.fn(),
  customerUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    customer: { findFirst: mocks.customerFindFirst },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "./auth-token.js";

const createdAt = new Date("2025-02-01T00:00:00.000Z");
const internalUser = (role: Role) => ({
  id: `user-${role.toLowerCase()}`,
  name: `${role} User`,
  email: `${role.toLowerCase()}@example.com`,
  phone: "+201000000000",
  role,
  isActive: true,
  createdAt,
  passwordChangedAt: null,
  customerProfile: null,
});

const authFor = (user: ReturnType<typeof internalUser>) => ({
  Authorization: `Bearer ${createAccessToken({ id: user.id, role: user.role })}`,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindFirst.mockResolvedValue(null);
  mocks.customerFindFirst.mockResolvedValue(null);
  mocks.userUpdate.mockResolvedValue({ id: "updated" });
  mocks.customerUpdate.mockResolvedValue({ id: "customer-1" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({ user: { update: mocks.userUpdate }, customer: { update: mocks.customerUpdate } }),
  );
});

describe("self profile API", () => {
  for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT, Role.CUSTOMER]) {
    it(`returns a safe ${role} profile`, async () => {
      const user = internalUser(role);
      if (role === Role.CUSTOMER) {
        user.customerProfile = {
          id: "customer-1",
          name: "Customer Name",
          email: "customer@example.com",
          phone: "+201111111111",
        } as never;
      }
      mocks.userFindUnique.mockResolvedValue(user);

      const response = await request(app).get("/api/auth/profile").set(authFor(user));

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ role, createdAt: createdAt.toISOString() });
      expect(response.body.data).not.toHaveProperty("passwordHash");
    });
  }

  it("updates only the authenticated user's name, email and phone", async () => {
    const user = internalUser(Role.ADMIN);
    mocks.userFindUnique.mockResolvedValue(user);
    const response = await request(app)
      .patch("/api/auth/profile")
      .set(authFor(user))
      .send({ name: "Updated Admin", email: "updated@example.com", phone: "+202222222222" });

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { name: "Updated Admin", email: "updated@example.com", phone: "+202222222222" },
    });
    expect(response.body.data).not.toHaveProperty("passwordHash");
  });

  it("synchronizes a CUSTOMER User and Customer row", async () => {
    const user = {
      ...internalUser(Role.CUSTOMER),
      customerProfile: { id: "customer-1", name: "Old", email: "old@example.com", phone: null },
    };
    mocks.userFindUnique.mockResolvedValue(user);
    const response = await request(app)
      .patch("/api/auth/profile")
      .set(authFor(user))
      .send({ name: "New Name", email: "new@example.com", phone: "+203333333333" });

    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledOnce();
    expect(mocks.customerUpdate).toHaveBeenCalledOnce();
  });

  it("rejects unknown fields", async () => {
    const user = internalUser(Role.AGENT);
    const response = await request(app)
      .patch("/api/auth/profile")
      .set(authFor(user))
      .send({ name: "Agent User", email: "agent@example.com", role: "ADMIN" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 EMAIL_IN_USE for a friendly duplicate pre-check", async () => {
    const user = internalUser(Role.MANAGER);
    mocks.userFindUnique.mockResolvedValue(user);
    mocks.userFindFirst.mockResolvedValue({ id: "other" });
    const response = await request(app)
      .patch("/api/auth/profile")
      .set(authFor(user))
      .send({ name: user.name, email: "taken@example.com", phone: user.phone });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("maps a Prisma P2002 race to 409 EMAIL_IN_USE", async () => {
    const user = internalUser(Role.ADMIN);
    mocks.userFindUnique.mockResolvedValue(user);
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" }),
    );
    const response = await request(app)
      .patch("/api/auth/profile")
      .set(authFor(user))
      .send({ name: user.name, email: "race@example.com", phone: user.phone });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("rejects a stale token", async () => {
    const user = { ...internalUser(Role.AGENT), passwordChangedAt: new Date(Date.now() + 60_000) };
    mocks.userFindUnique.mockResolvedValue(user);
    const response = await request(app).get("/api/auth/profile").set(authFor(user));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
  });
});
