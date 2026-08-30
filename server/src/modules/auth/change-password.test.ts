import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    auditLog: { create: mocks.auditCreate },
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    compare: vi.fn(async (password: string, hash: string) => hash === `hashed:${password}`),
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "./auth-token.js";

const token = createAccessToken({ id: "user-1", role: "CUSTOMER" as never });
const authed = (body: unknown) =>
  request(app).patch("/api/auth/change-password").set("Authorization", `Bearer ${token}`).send(body);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({
    id: "user-1",
    role: "CUSTOMER",
    isActive: true,
    passwordHash: "hashed:currentpass1",
  });
  mocks.userUpdate.mockResolvedValue({ id: "user-1" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
});

describe("change password", () => {
  it("changes the password and returns a fresh token", async () => {
    const response = await authed({
      currentPassword: "currentpass1",
      newPassword: "brandnewpass1",
      confirmPassword: "brandnewpass1",
    });
    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: "hashed:brandnewpass1", passwordChangedAt: expect.any(Date) }),
      }),
    );
  });

  it("rejects an incorrect current password", async () => {
    const response = await authed({
      currentPassword: "wrongpass1",
      newPassword: "brandnewpass1",
      confirmPassword: "brandnewpass1",
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_PASSWORD");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects mismatched confirmation", async () => {
    const response = await authed({
      currentPassword: "currentpass1",
      newPassword: "brandnewpass1",
      confirmPassword: "different1",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a new password equal to the current one", async () => {
    const response = await authed({
      currentPassword: "currentpass1",
      newPassword: "currentpass1",
      confirmPassword: "currentpass1",
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires authentication", async () => {
    const response = await request(app).patch("/api/auth/change-password").send({
      currentPassword: "currentpass1",
      newPassword: "brandnewpass1",
      confirmPassword: "brandnewpass1",
    });
    expect(response.status).toBe(401);
  });
});
