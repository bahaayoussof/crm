import { Prisma, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  customerFindUnique: vi.fn(),
  customerFindFirst: vi.fn(),
  customerUpdate: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    customer: { findUnique: mocks.customerFindUnique, findFirst: mocks.customerFindFirst, update: mocks.customerUpdate },
    auditLog: { create: mocks.auditCreate },
    $transaction: mocks.transaction,
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const customerAuth = { Authorization: `Bearer ${createAccessToken({ id: "cc6c289e49e9c05b214586038", role: Role.CUSTOMER })}` };
const txClient = { customer: { update: mocks.customerUpdate }, user: { update: mocks.userUpdate } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({ passwordChangedAt: null });
  mocks.customerFindUnique.mockResolvedValue({
    id: "ce83f10dcd2c68747c3f3ba14",
    name: "Bahaa Youssof",
    email: "bahaa@example.com",
    phone: "+14155552671",
    createdAt: new Date("2025-01-15T00:00:00.000Z"),
    user: { role: Role.CUSTOMER, passwordChangedAt: null },
  });
  mocks.userFindFirst.mockResolvedValue(null);
  mocks.customerFindFirst.mockResolvedValue(null);
  mocks.customerUpdate.mockResolvedValue({ id: "ce83f10dcd2c68747c3f3ba14" });
  mocks.userUpdate.mockResolvedValue({ id: "cc6c289e49e9c05b214586038" });
  mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof txClient) => unknown)(txClient) : Promise.all(arg as Promise<unknown>[]),
  );
});

describe("portal profile", () => {
  it("returns the authenticated customer's own profile", async () => {
    const response = await request(app).get("/api/portal/profile").set(customerAuth);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      name: "Bahaa Youssof",
      email: "bahaa@example.com",
      phone: "+14155552671",
      role: "CUSTOMER",
      createdAt: "2025-01-15T00:00:00.000Z",
      passwordChangedAt: null,
    });
  });

  it("rejects internal roles", async () => {
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      const response = await request(app)
        .get("/api/portal/profile")
        .set({ Authorization: `Bearer ${createAccessToken({ id: "staff", role })}` });
      expect(response.status).toBe(403);
    }
  });

  it("updates name / email / phone through an explicit whitelist", async () => {
    const response = await request(app)
      .patch("/api/portal/profile")
      .set(customerAuth)
      .send({ name: "Bahaa Y", email: "new@example.com", phone: "+14155552672" });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ name: "Bahaa Y", email: "new@example.com", phone: "+14155552672" });
    expect(mocks.customerUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Bahaa Y", email: "new@example.com", phone: "+14155552672" } }),
    );
    expect(mocks.userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: "Bahaa Y", email: "new@example.com", phone: "+14155552672" } }),
    );
    expect(mocks.auditCreate).toHaveBeenCalled();
  });

  it("clears the phone when an empty string is submitted", async () => {
    const response = await request(app)
      .patch("/api/portal/profile")
      .set(customerAuth)
      .send({ name: "Bahaa Youssof", email: "bahaa@example.com", phone: "" });
    expect(response.status).toBe(200);
    expect(response.body.data.phone).toBeNull();
  });

  it("normalizes formatted international phone input", async () => {
    const response = await request(app).patch("/api/portal/profile").set(customerAuth).send({
      name: "Bahaa Youssof", email: " BAhaa@Example.com ", phone: "+1 (415) 555-2671",
    });
    expect(response.status).toBe(200);
    expect(mocks.customerUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: "Bahaa Youssof", email: "bahaa@example.com", phone: "+14155552671" },
    }));
  });

  it("rejects a duplicate email with 409 EMAIL_IN_USE", async () => {
    mocks.userFindFirst.mockResolvedValue({ id: "other-user" });
    const response = await request(app)
      .patch("/api/portal/profile")
      .set(customerAuth)
      .send({ name: "Bahaa Youssof", email: "taken@example.com", phone: "+14155552671" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("maps a Prisma P2002 unique-constraint race to 409, never 500", async () => {
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6" }),
    );
    const response = await request(app)
      .patch("/api/portal/profile")
      .set(customerAuth)
      .send({ name: "Bahaa Youssof", email: "race@example.com", phone: "+14155552671" });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("rejects unknown fields (role escalation attempt)", async () => {
    const response = await request(app)
      .patch("/api/portal/profile")
      .set(customerAuth)
      .send({ name: "Bahaa Youssof", email: "bahaa@example.com", role: "ADMIN" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a token issued before the last password change (stale session)", async () => {
    mocks.userFindUnique.mockResolvedValue({ passwordChangedAt: new Date(Date.now() + 60_000) });
    const response = await request(app).get("/api/portal/profile").set(customerAuth);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
  });
});
