import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findCustomer: vi.fn(),
  transaction: vi.fn(),
  createUser: vi.fn(),
  createCustomer: vi.fn(),
  findCreatedUser: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    customer: { findUnique: mocks.findCustomer },
    $transaction: mocks.transaction,
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async (password: string) => `hashed:${password}`),
    compare: vi.fn(async (password: string, hash: string) => hash === `hashed:${password}`),
  },
}));

import { app } from "../../app.js";

const customerUser = {
  id: "cc6c289e49e9c05b214586038",
  name: "Ahmed Mohamed",
  email: "ahmed@example.com",
  role: "CUSTOMER" as const,
  isActive: true,
  customerProfile: {
    id: "ce83f10dcd2c68747c3f3ba14",
    name: "Ahmed Mohamed",
    email: "ahmed@example.com",
    phone: "+14155552671",
  },
};

describe("authentication API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue(null);
    mocks.findCustomer.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ id: customerUser.id });
    mocks.createCustomer.mockResolvedValue(customerUser.customerProfile);
    mocks.findCreatedUser.mockResolvedValue(customerUser);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        user: { create: mocks.createUser, findUniqueOrThrow: mocks.findCreatedUser },
        customer: { create: mocks.createCustomer },
      }),
    );
  });

  it("registers a normalized CUSTOMER identity and profile transactionally", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "  Ahmed Mohamed  ",
      email: "  Ahmed@Example.com ",
      password: "password123",
      phone: "+14155552671",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({
      email: "ahmed@example.com",
      role: "CUSTOMER",
      customer: { id: "ce83f10dcd2c68747c3f3ba14" },
    });
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "ahmed@example.com",
          passwordHash: "hashed:password123",
          role: "CUSTOMER",
        }),
      }),
    );
    expect(mocks.createCustomer).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "cc6c289e49e9c05b214586038", email: "ahmed@example.com" }),
    });
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate email registrations", async () => {
    mocks.findUser.mockResolvedValue({ id: "existing" });

    const response = await request(app).post("/api/auth/register").send({
      name: "Ahmed Mohamed",
      email: "ahmed@example.com",
      password: "password123",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects role escalation fields during public registration", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Attacker",
      email: "attacker@example.com",
      password: "password123",
      role: "ADMIN",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("logs in any valid role using a normalized email", async () => {
    mocks.findUser.mockResolvedValue({
      ...customerUser,
      role: "ADMIN",
      customerProfile: null,
      passwordHash: "hashed:password123",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: " AHMED@EXAMPLE.COM ",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe("ADMIN");
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
    expect(mocks.findUser).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "ahmed@example.com" } }));
  });

  it("returns a generic error for invalid credentials", async () => {
    mocks.findUser.mockResolvedValue({ ...customerUser, passwordHash: "hashed:different-password" });

    const response = await request(app).post("/api/auth/login").send({
      email: "ahmed@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  });

  it("blocks login for a deactivated account", async () => {
    mocks.findUser.mockResolvedValue({ ...customerUser, isActive: false, passwordHash: "hashed:password123" });

    const response = await request(app).post("/api/auth/login").send({
      email: "ahmed@example.com",
      password: "password123",
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects /auth/me once an account is deactivated", async () => {
    mocks.findUser.mockResolvedValueOnce({ ...customerUser, passwordHash: "hashed:password123" });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "ahmed@example.com",
      password: "password123",
    });

    mocks.findUser.mockResolvedValueOnce({ ...customerUser, isActive: false });
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects missing and invalid tokens", async () => {
    const missing = await request(app).get("/api/auth/me");
    const invalid = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-jwt");

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("INVALID_TOKEN");
  });

  it("returns the safe current user for a valid token", async () => {
    mocks.findUser.mockResolvedValueOnce({ ...customerUser, passwordHash: "hashed:password123" });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "ahmed@example.com",
      password: "password123",
    });

    mocks.findUser.mockResolvedValueOnce(customerUser);
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ id: "cc6c289e49e9c05b214586038", role: "CUSTOMER" });
    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });
});
