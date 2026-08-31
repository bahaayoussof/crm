import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  tokenFindUnique: vi.fn(),
  tokenDeleteMany: vi.fn(),
  tokenCreate: vi.fn(),
  tokenUpdateMany: vi.fn(),
  userUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    passwordResetToken: {
      findUnique: mocks.tokenFindUnique,
      deleteMany: mocks.tokenDeleteMany,
      create: mocks.tokenCreate,
      updateMany: mocks.tokenUpdateMany,
    },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

vi.mock("../email/password-reset.email.js", () => ({
  sendPasswordResetEmail: vi.fn(async () => undefined),
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    compare: vi.fn(async (password: string, hash: string) => hash === `hashed:${password}`),
  },
}));

import { app } from "../../app.js";
import { resetPassword } from "./password-reset.service.js";
import { sendPasswordResetEmail } from "../email/password-reset.email.js";

const txClient = {
  passwordResetToken: {
    deleteMany: mocks.tokenDeleteMany,
    create: mocks.tokenCreate,
    updateMany: mocks.tokenUpdateMany,
    findUnique: mocks.tokenFindUnique,
  },
  user: { update: mocks.userUpdate },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof txClient) => unknown)(txClient) : Promise.all(arg as Promise<unknown>[]),
  );
  mocks.tokenDeleteMany.mockResolvedValue({ count: 0 });
  mocks.tokenCreate.mockResolvedValue({ id: "prt-1" });
  mocks.tokenUpdateMany.mockResolvedValue({ count: 1 });
  mocks.userUpdate.mockResolvedValue({ id: "cc6c289e49e9c05b214586038" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
});

describe("forgot password", () => {
  it("returns the same generic response for every existing role", async () => {
    for (const role of ["CUSTOMER", "ADMIN", "MANAGER", "AGENT"]) {
      mocks.userFindUnique.mockResolvedValueOnce({ id: `u-${role}`, name: role, email: `${role}@example.com` });
      const response = await request(app).post("/api/auth/forgot-password").send({ email: `${role}@example.com` });
      expect(response.status).toBe(200);
      expect(response.body.data.message).toMatch(/if an account exists/i);
    }
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(4);
  });

  it("returns the identical response for an unknown email and sends nothing", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const response = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });
    expect(response.status).toBe(200);
    expect(response.body.data.message).toMatch(/if an account exists/i);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const response = await request(app).post("/api/auth/forgot-password").send({ email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("persists only the SHA-256 hash of the token, never the raw token", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "cc6c289e49e9c05b214586038", name: "A", email: "a@example.com" });
    await request(app).post("/api/auth/forgot-password").send({ email: "a@example.com" });
    const created = mocks.tokenCreate.mock.calls.at(-1)![0].data as { tokenHash: string };
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    const sentUrl = (sendPasswordResetEmail as unknown as { mock: { calls: [{ resetUrl: string }][] } }).mock.calls.at(-1)![0].resetUrl;
    const rawToken = new URL(sentUrl).searchParams.get("token")!;
    expect(created.tokenHash).not.toBe(rawToken);
    expect(rawToken.length).toBeGreaterThan(20);
  });

  it("deletes prior unused tokens before issuing a new one", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "cc6c289e49e9c05b214586038", name: "A", email: "a@example.com" });
    await request(app).post("/api/auth/forgot-password").send({ email: "a@example.com" });
    expect(mocks.tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "cc6c289e49e9c05b214586038", usedAt: null } });
  });
});

describe("reset password", () => {
  const future = () => new Date(Date.now() + 60_000);
  const past = () => new Date(Date.now() - 60_000);

  it("resets the password for a valid token", async () => {
    mocks.tokenFindUnique.mockResolvedValue({ id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: null, expiresAt: future() });
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "raw-token", password: "newpassword1", confirmPassword: "newpassword1" });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ ok: true });
    expect(response.body.data).not.toHaveProperty("token");
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: "hashed:newpassword1" }) }),
    );
  });

  it("rejects an expired token", async () => {
    mocks.tokenFindUnique.mockResolvedValue({ id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: null, expiresAt: past() });
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "raw-token", password: "newpassword1", confirmPassword: "newpassword1" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TOKEN_EXPIRED");
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unknown token", async () => {
    mocks.tokenFindUnique.mockResolvedValue(null);
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "raw-token", password: "newpassword1", confirmPassword: "newpassword1" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TOKEN_INVALID");
  });

  it("rejects an already-used token", async () => {
    mocks.tokenFindUnique.mockResolvedValue({ id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: new Date(), expiresAt: future() });
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "raw-token", password: "newpassword1", confirmPassword: "newpassword1" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TOKEN_INVALID");
  });

  it("rejects mismatched passwords", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "raw-token", password: "newpassword1", confirmPassword: "different1" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("allows only one of two concurrent consumers of the same token", async () => {
    mocks.tokenFindUnique.mockResolvedValue({ id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: null, expiresAt: future() });
    let claimed = false;
    mocks.tokenUpdateMany.mockImplementation(async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    });
    // After the first claim, a re-read inside the losing transaction sees it used.
    mocks.tokenFindUnique.mockImplementation(async () =>
      claimed
        ? { id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: new Date(), expiresAt: future() }
        : { id: "prt-1", userId: "cc6c289e49e9c05b214586038", usedAt: null, expiresAt: future() },
    );

    const results = await Promise.allSettled([
      resetPassword({ token: "raw", password: "newpassword1", confirmPassword: "newpassword1" }),
      resetPassword({ token: "raw", password: "newpassword2", confirmPassword: "newpassword2" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "TOKEN_INVALID" });
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
  });
});
