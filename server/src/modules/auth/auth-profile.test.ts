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
  bcryptCompare: vi.fn(),
  bcryptHash: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    customer: { findFirst: mocks.customerFindFirst },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: mocks.bcryptHash,
    compare: mocks.bcryptCompare,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "./auth-token.js";

const createdAt = new Date("2025-02-01T00:00:00.000Z");
const internalUser = (role: Role) => ({
  id: `user-${role.toLowerCase()}`,
  name: `${role} User`,
  email: `${role.toLowerCase()}@example.com`,
  phone: "+14155552671",
  role,
  isActive: true,
  createdAt,
  passwordChangedAt: null,
  passwordHash: "hashed:CurrentPassword123!",
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
  mocks.customerUpdate.mockResolvedValue({ id: "ce83f10dcd2c68747c3f3ba14" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.bcryptCompare.mockImplementation(async (password: string, hash: string) => hash === `hashed:${password}`);
  mocks.bcryptHash.mockImplementation(async (password: string) => `hashed:${password}`);
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
          id: "ce83f10dcd2c68747c3f3ba14",
          name: "Customer Name",
          email: "customer@example.com",
          phone: "+14155552672",
        } as never;
      }
      mocks.userFindUnique.mockResolvedValue(user);

      const response = await request(app).get("/api/auth/profile").set(authFor(user));

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ role, createdAt: createdAt.toISOString() });
      expect(response.body.data).not.toHaveProperty("passwordHash");
    });
  }

  describe("ADMIN role permissions", () => {
    it("can update name, email, and phone with audit log capturing allowed changes", async () => {
      const admin = internalUser(Role.ADMIN);
      mocks.userFindUnique.mockResolvedValue(admin);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(admin))
        .send({ name: "Updated Admin", email: "updated-admin@example.com", phone: "+14155552673" });

      expect(response.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: admin.id },
        data: { name: "Updated Admin", email: "updated-admin@example.com", phone: "+14155552673" },
      });
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              changes: {
                name: { from: admin.name, to: "Updated Admin" },
                email: { from: admin.email, to: "updated-admin@example.com" },
                phone: { from: admin.phone, to: "+14155552673" },
              },
            }),
          }),
        }),
      );
    });
  });

  describe("CUSTOMER role permissions", () => {
    it("can update name, email, and phone and synchronizes User and Customer rows", async () => {
      const customer = {
        ...internalUser(Role.CUSTOMER),
        customerProfile: { id: "ce83f10dcd2c68747c3f3ba14", name: "Old Cust", email: "old@example.com", phone: null },
      };
      mocks.userFindUnique.mockResolvedValue(customer);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(customer))
        .send({ name: "New Cust", email: "new@example.com", phone: "+14155552674" });

      expect(response.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledOnce();
      expect(mocks.customerUpdate).toHaveBeenCalledOnce();
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              changes: {
                name: { from: "Old Cust", to: "New Cust" },
                email: { from: "old@example.com", to: "new@example.com" },
                phone: { from: null, to: "+14155552674" },
              },
            }),
          }),
        }),
      );
    });
  });

  describe("MANAGER role permissions", () => {
    it("can update phone", async () => {
      const manager = internalUser(Role.MANAGER);
      mocks.userFindUnique.mockResolvedValue(manager);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(manager))
        .send({ phone: "+201001234567" });

      expect(response.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: manager.id },
        data: { phone: "+201001234567" },
      });
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              changes: {
                phone: { from: manager.phone, to: "+201001234567" },
              },
            }),
          }),
        }),
      );
    });

    it("cannot update name and returns 403 with generic message", async () => {
      const manager = internalUser(Role.MANAGER);
      mocks.userFindUnique.mockResolvedValue(manager);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(manager))
        .send({ name: "New Manager Name" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("cannot update email and returns 403 with generic message", async () => {
      const manager = internalUser(Role.MANAGER);
      mocks.userFindUnique.mockResolvedValue(manager);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(manager))
        .send({ email: "manager-new@example.com" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("atomically rejects mixed forbidden payload", async () => {
      const manager = internalUser(Role.MANAGER);
      mocks.userFindUnique.mockResolvedValue(manager);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(manager))
        .send({ name: "Unauthorized Name", phone: "+201001234567" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("can change password via PATCH /api/auth/change-password", async () => {
      const manager = internalUser(Role.MANAGER);
      mocks.userFindUnique.mockResolvedValue(manager);
      const response = await request(app)
        .patch("/api/auth/change-password")
        .set(authFor(manager))
        .send({
          currentPassword: "CurrentPassword123!",
          newPassword: "BrandNewPassword123!",
          confirmPassword: "BrandNewPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("token");
    });
  });

  describe("AGENT role permissions", () => {
    it("can update phone", async () => {
      const agent = internalUser(Role.AGENT);
      mocks.userFindUnique.mockResolvedValue(agent);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(agent))
        .send({ phone: "+201009876543" });

      expect(response.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: agent.id },
        data: { phone: "+201009876543" },
      });
      expect(mocks.auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              changes: {
                phone: { from: agent.phone, to: "+201009876543" },
              },
            }),
          }),
        }),
      );
    });

    it("cannot update name and returns 403 with generic message", async () => {
      const agent = internalUser(Role.AGENT);
      mocks.userFindUnique.mockResolvedValue(agent);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(agent))
        .send({ name: "New Agent Name" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("cannot update email and returns 403 with generic message", async () => {
      const agent = internalUser(Role.AGENT);
      mocks.userFindUnique.mockResolvedValue(agent);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(agent))
        .send({ email: "agent-new@example.com" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("atomically rejects mixed forbidden payload", async () => {
      const agent = internalUser(Role.AGENT);
      mocks.userFindUnique.mockResolvedValue(agent);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(agent))
        .send({ email: "agent-new@example.com", phone: "+201009876543" });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(response.body.error.message).toBe("You are not allowed to update one or more profile fields.");
      expect(mocks.userUpdate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("can change password via PATCH /api/auth/change-password", async () => {
      const agent = internalUser(Role.AGENT);
      mocks.userFindUnique.mockResolvedValue(agent);
      const response = await request(app)
        .patch("/api/auth/change-password")
        .set(authFor(agent))
        .send({
          currentPassword: "CurrentPassword123!",
          newPassword: "BrandNewPassword123!",
          confirmPassword: "BrandNewPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("token");
    });
  });

  describe("Validation and boundary guards", () => {
    it("normalizes a formatted international phone and rejects malformed values", async () => {
      const user = internalUser(Role.ADMIN);
      mocks.userFindUnique.mockResolvedValue(user);
      const valid = await request(app).patch("/api/auth/profile").set(authFor(user)).send({
        name: "  أحمد محمد  ", email: " ADMIN@Example.com ", phone: "+44 20 7946 0958",
      });
      expect(valid.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: { name: "أحمد محمد", email: "admin@example.com", phone: "+442079460958" },
      }));

      for (const phone of ["abc123", "++++123", "12", "01001234567"]) {
        const invalid = await request(app).patch("/api/auth/profile").set(authFor(user)).send({
          name: user.name, email: user.email, phone,
        });
        expect(invalid.status).toBe(400);
        expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("rejects an empty payload with 400 VALIDATION_ERROR", async () => {
      const user = internalUser(Role.ADMIN);
      mocks.userFindUnique.mockResolvedValue(user);
      const response = await request(app).patch("/api/auth/profile").set(authFor(user)).send({});
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects unknown fields", async () => {
      const user = internalUser(Role.ADMIN);
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(user))
        .send({ name: "Admin User", email: "admin@example.com", role: "MANAGER" });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 409 EMAIL_IN_USE for duplicate pre-check for allowed roles", async () => {
      const admin = internalUser(Role.ADMIN);
      mocks.userFindUnique.mockResolvedValue(admin);
      mocks.userFindFirst.mockResolvedValue({ id: "other" });
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(admin))
        .send({ name: admin.name, email: "taken@example.com", phone: admin.phone });
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("EMAIL_IN_USE");
    });

    it("maps a Prisma P2002 race to 409 EMAIL_IN_USE", async () => {
      const admin = internalUser(Role.ADMIN);
      mocks.userFindUnique.mockResolvedValue(admin);
      mocks.transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" }),
      );
      const response = await request(app)
        .patch("/api/auth/profile")
        .set(authFor(admin))
        .send({ name: admin.name, email: "race@example.com", phone: admin.phone });
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
});
