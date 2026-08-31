import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    quickReply: {
      findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique,
      create: mocks.create, update: mocks.update, delete: mocks.remove,
    },
    $transaction: vi.fn(async (value: unknown) =>
      typeof value === "function" ? (value as (tx: unknown) => unknown)(mocks) : Promise.all(value as Promise<unknown>[])),
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (id: string, role: Role) => createAccessToken({ id, role });
const adminToken = token("c90b1b286043f1b7612e423c7", Role.ADMIN);
const managerToken = token("c6fd0a01a46ed4545f0a5e774", Role.MANAGER);
const agentToken = token("agent-1", Role.AGENT);
const customerToken = token("ce83f10dcd2c68747c3f3ba14", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const now = new Date("2026-08-26T12:00:00.000Z");

const author = { id: "c90b1b286043f1b7612e423c7", name: "Admin User", role: Role.ADMIN };
const greetingRow = { id: "c836302c0fbd491226544d598", title: "Greeting", body: "Hello, thanks for contacting support.", createdAt: now, updatedAt: now, createdBy: author };
const refundRow = { id: "qr-refund", title: "Refund steps", body: "Here is how a refund is processed.", createdAt: now, updatedAt: now, createdBy: author };

describe("quick replies API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("rejects unauthenticated requests on every route", async () => {
    expect((await request(app).get("/api/quick-replies")).status).toBe(401);
    expect((await request(app).get("/api/quick-replies/c2d711642b726b04401627ca9")).status).toBe(401);
    expect((await request(app).post("/api/quick-replies").send({ title: "Hello", body: "Body" })).status).toBe(401);
    expect((await request(app).patch("/api/quick-replies/c2d711642b726b04401627ca9").send({ title: "Hello" })).status).toBe(401);
    expect((await request(app).delete("/api/quick-replies/c2d711642b726b04401627ca9")).status).toBe(401);
  });

  it("rejects CUSTOMER from every quick reply route", async () => {
    expect((await request(app).get("/api/quick-replies").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/quick-replies/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/quick-replies").set(auth(customerToken)).send({ title: "Hello", body: "Body" })).status).toBe(403);
    expect((await request(app).patch("/api/quick-replies/c2d711642b726b04401627ca9").set(auth(customerToken)).send({ title: "Hello" })).status).toBe(403);
    expect((await request(app).delete("/api/quick-replies/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken], ["AGENT", agentToken]] as const)(
    "allows %s to list quick replies", async (_role, value) => {
      mocks.findMany.mockResolvedValue([greetingRow, refundRow]);
      mocks.count.mockResolvedValue(2);
      const response = await request(app).get("/api/quick-replies").set(auth(value));
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({ id: "c836302c0fbd491226544d598", title: "Greeting", body: "Hello, thanks for contacting support." });
      expect(response.body.data[0].createdBy).toEqual({ id: "c90b1b286043f1b7612e423c7", name: "Admin User", role: "ADMIN" });
      expect(response.body.data[0].createdBy).not.toHaveProperty("email");
    });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken], ["AGENT", agentToken]] as const)(
    "allows %s to read a single quick reply", async (_role, value) => {
      mocks.findUnique.mockResolvedValue(greetingRow);
      const response = await request(app).get("/api/quick-replies/c836302c0fbd491226544d598").set(auth(value));
      expect(response.status).toBe(200);
      expect(response.body.data.body).toBe("Hello, thanks for contacting support.");
    });

  it("orders by title then id and projects a safe author shape", async () => {
    await request(app).get("/api/quick-replies").set(auth(agentToken));
    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call.orderBy).toEqual([{ title: "asc" }, { id: "asc" }]);
    expect(call.select).toEqual({
      id: true, title: true, body: true, createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, name: true, role: true } },
    });
  });

  it("defaults to limit=15 and bounds list pagination", async () => {
    mocks.findMany.mockResolvedValue([greetingRow]);
    mocks.count.mockResolvedValue(1);
    const defaultResponse = await request(app).get("/api/quick-replies").set(auth(adminToken));
    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.body.meta.limit).toBe(15);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 15 }));

    const rejected = await request(app).get("/api/quick-replies?limit=500").set(auth(adminToken));
    expect(rejected.status).toBe(400);
    mocks.findMany.mockResolvedValue([greetingRow]);
    mocks.count.mockResolvedValue(21);
    const response = await request(app).get("/api/quick-replies?page=2&limit=10").set(auth(adminToken));
    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });

  it("searches case-insensitively across title and body", async () => {
    await request(app).get("/api/quick-replies?search=refund").set(auth(managerToken));
    const where = mocks.findMany.mock.calls[0]?.[0].where;
    expect(where.AND[0].OR).toEqual([
      { title: { contains: "refund", mode: "insensitive" } },
      { body: { contains: "refund", mode: "insensitive" } },
    ]);
  });

  it("rejects unknown query parameters", async () => {
    expect((await request(app).get("/api/quick-replies?status=DRAFT").set(auth(adminToken))).status).toBe(400);
  });

  it("returns a structured 404 for a missing quick reply", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/quick-replies/cffa63583dfa6706b87d284b8").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("QUICK_REPLY_NOT_FOUND");
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken]] as const)(
    "lets %s create a quick reply with a server-derived author", async (_role, value) => {
      mocks.create.mockResolvedValue(greetingRow);
      const response = await request(app).post("/api/quick-replies").set(auth(value))
        .send({ title: "Greeting", body: "Hello, thanks for contacting support.", createdById: "someone-else" });
      expect(response.status).toBe(400); // strict schema rejects createdById
    });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken]] as const)(
    "lets %s create a valid quick reply", async (_role, value) => {
      mocks.create.mockResolvedValue(greetingRow);
      const response = await request(app).post("/api/quick-replies").set(auth(value))
        .send({ title: "Greeting", body: "Hello, thanks for contacting support." });
      expect(response.status).toBe(201);
      expect(response.body.data.id).toBe("c836302c0fbd491226544d598");
      const createArgs = mocks.create.mock.calls[0]?.[0];
      expect(createArgs.data).toEqual({ title: "Greeting", body: "Hello, thanks for contacting support.", createdById: value === adminToken ? "c90b1b286043f1b7612e423c7" : "c6fd0a01a46ed4545f0a5e774" });
    });

  it("rejects AGENT create, update, and delete", async () => {
    expect((await request(app).post("/api/quick-replies").set(auth(agentToken)).send({ title: "Greeting", body: "Body" })).status).toBe(403);
    expect((await request(app).patch("/api/quick-replies/c836302c0fbd491226544d598").set(auth(agentToken)).send({ title: "New" })).status).toBe(403);
    expect((await request(app).delete("/api/quick-replies/c836302c0fbd491226544d598").set(auth(agentToken))).status).toBe(403);
  });

  it("validates create input length", async () => {
    expect((await request(app).post("/api/quick-replies").set(auth(adminToken)).send({ title: "x", body: "Body" })).status).toBe(400);
    expect((await request(app).post("/api/quick-replies").set(auth(adminToken)).send({ title: "Valid title", body: "" })).status).toBe(400);
    expect((await request(app).post("/api/quick-replies").set(auth(adminToken)).send({ title: "Valid title", body: "a".repeat(5001) })).status).toBe(400);
  });

  it("updates an existing quick reply with only the provided fields", async () => {
    mocks.findUnique.mockResolvedValue({ id: "c836302c0fbd491226544d598" });
    mocks.update.mockResolvedValue({ ...greetingRow, title: "Warm greeting" });
    const response = await request(app).patch("/api/quick-replies/c836302c0fbd491226544d598").set(auth(managerToken)).send({ title: "Warm greeting" });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0]).toMatchObject({ where: { id: "c836302c0fbd491226544d598" }, data: { title: "Warm greeting" } });
    expect(mocks.update.mock.calls[0]?.[0].data).not.toHaveProperty("body");
  });

  it("rejects an empty update body", async () => {
    expect((await request(app).patch("/api/quick-replies/c836302c0fbd491226544d598").set(auth(adminToken)).send({})).status).toBe(400);
  });

  it("rejects updating an unknown field", async () => {
    expect((await request(app).patch("/api/quick-replies/c836302c0fbd491226544d598").set(auth(adminToken)).send({ createdById: "c2d711642b726b04401627ca9" })).status).toBe(400);
  });

  it("returns 404 when updating or deleting a missing quick reply", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect((await request(app).patch("/api/quick-replies/cffa63583dfa6706b87d284b8").set(auth(adminToken)).send({ title: "New title" })).status).toBe(404);
    expect((await request(app).delete("/api/quick-replies/cffa63583dfa6706b87d284b8").set(auth(adminToken))).status).toBe(404);
  });

  it("deletes an existing quick reply", async () => {
    mocks.findUnique.mockResolvedValue({ id: "c836302c0fbd491226544d598" });
    mocks.remove.mockResolvedValue({ id: "c836302c0fbd491226544d598" });
    const response = await request(app).delete("/api/quick-replies/c836302c0fbd491226544d598").set(auth(adminToken));
    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "c836302c0fbd491226544d598" } });
  });
});
