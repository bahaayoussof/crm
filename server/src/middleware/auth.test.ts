import { Role } from "@prisma/client";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./error-handler.js";
import { requireAuth, requireRole } from "./auth.js";
import { createAccessToken } from "../modules/auth/auth-token.js";

const testApp = express();
testApp.get("/admin", requireAuth, requireRole(Role.ADMIN), (_request, response) => {
  response.status(200).json({ status: "ok" });
});
testApp.use(errorHandler);

describe("authorization middleware", () => {
  it("allows an accepted role and rejects another authenticated role", async () => {
    const adminToken = createAccessToken({ id: "admin-1", role: Role.ADMIN });
    const customerToken = createAccessToken({ id: "customer-1", role: Role.CUSTOMER });

    const allowed = await request(testApp).get("/admin").set("Authorization", `Bearer ${adminToken}`);
    const forbidden = await request(testApp).get("/admin").set("Authorization", `Bearer ${customerToken}`);

    expect(allowed.status).toBe(200);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });
});
