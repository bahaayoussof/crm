import { Role } from "@prisma/client";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("../config/prisma.js", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
import { errorHandler } from "./error-handler.js";
import { requireAuth, requireRole } from "./auth.js";
import { createAccessToken } from "../modules/auth/auth-token.js";

const testApp = express();
testApp.get("/admin", requireAuth, requireRole(Role.ADMIN), (_request, response) => {
  response.status(200).json({ status: "ok", role: _request.auth?.role });
});
testApp.use(errorHandler);

describe("authorization middleware", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.findUnique.mockResolvedValue({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true });
  });

  it("allows an accepted role and rejects another authenticated role", async () => {
    const adminToken = createAccessToken({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN });
    const customerToken = createAccessToken({ id: "ce83f10dcd2c68747c3f3ba14", role: Role.CUSTOMER });
    mocks.findUnique
      .mockResolvedValueOnce({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true })
      .mockResolvedValueOnce({ id: "ce83f10dcd2c68747c3f3ba14", role: Role.CUSTOMER, isActive: true });

    const allowed = await request(testApp).get("/admin").set("Authorization", `Bearer ${adminToken}`);
    const forbidden = await request(testApp).get("/admin").set("Authorization", `Bearer ${customerToken}`);

    expect(allowed.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("uses the current database role and passes it to downstream authorization", async () => {
    const staleAgentToken = createAccessToken({ id: "c90b1b286043f1b7612e423c7", role: Role.AGENT });
    mocks.findUnique.mockResolvedValue({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: true });

    const response = await request(testApp).get("/admin").set("Authorization", `Bearer ${staleAgentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe("ADMIN");
  });

  it("rejects a stale elevated role after demotion", async () => {
    const staleAdminToken = createAccessToken({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN });
    mocks.findUnique.mockResolvedValue({ id: "c90b1b286043f1b7612e423c7", role: Role.AGENT, isActive: true });

    const response = await request(testApp).get("/admin").set("Authorization", `Bearer ${staleAdminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects an inactive current account", async () => {
      const token = createAccessToken({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN });
      mocks.findUnique.mockResolvedValue({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN, isActive: false });

      const response = await request(testApp).get("/admin").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("ACCOUNT_DEACTIVATED");
  });

  it("rejects a token issued before the current password", async () => {
    const token = createAccessToken({ id: "c90b1b286043f1b7612e423c7", role: Role.ADMIN });
    mocks.findUnique.mockResolvedValue({
      id: "c90b1b286043f1b7612e423c7",
      role: Role.ADMIN,
      isActive: true,
      passwordChangedAt: new Date(Date.now() + 5_000),
    });

    const response = await request(testApp).get("/admin").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("distinguishes missing, invalid, and expired authentication from forbidden access", async () => {
    const expired = jwt.sign({ role: Role.ADMIN }, env.JWT_SECRET, {
      subject: "c90b1b286043f1b7612e423c7",
      expiresIn: -1,
    });

    const missing = await request(testApp).get("/admin");
    const invalid = await request(testApp).get("/admin").set("Authorization", "Bearer not-a-token");
    const expiredResponse = await request(testApp).get("/admin").set("Authorization", `Bearer ${expired}`);

    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("AUTHENTICATION_REQUIRED");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe("INVALID_TOKEN");
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.error.code).toBe("INVALID_TOKEN");
  });
});
