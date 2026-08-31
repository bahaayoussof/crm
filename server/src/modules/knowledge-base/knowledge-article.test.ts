import { KnowledgeArticleStatus, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    knowledgeArticle: {
      findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique,
      findFirst: mocks.findFirst, create: mocks.create, update: mocks.update, delete: mocks.remove,
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
const draftRow = { id: "c529719cff715afea0ab75878", title: "Reset a password", category: "Accounts", status: KnowledgeArticleStatus.DRAFT, createdAt: now, updatedAt: now, createdBy: author };
const publishedRow = { id: "c4fdccb99802ca0574c1ecf12", title: "Billing FAQ", category: "Billing", status: KnowledgeArticleStatus.PUBLISHED, createdAt: now, updatedAt: now, createdBy: author };
const detailRow = { ...draftRow, content: "Full article content for internal readers." };

describe("internal knowledge base API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("rejects unauthenticated internal list requests", async () => {
    expect((await request(app).get("/api/knowledge-articles")).status).toBe(401);
  });

  it("rejects CUSTOMER from every internal knowledge base route", async () => {
    expect((await request(app).get("/api/knowledge-articles").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/knowledge-articles").set(auth(customerToken)).send({ title: "A valid title", content: "Body" })).status).toBe(403);
    expect((await request(app).patch("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken)).send({ title: "A valid title" })).status).toBe(403);
    expect((await request(app).delete("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken], ["AGENT", agentToken]] as const)(
    "allows %s to list all articles", async (_role, value) => {
      mocks.findMany.mockResolvedValue([draftRow, publishedRow]);
      mocks.count.mockResolvedValue(2);
      const response = await request(app).get("/api/knowledge-articles").set(auth(value));
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

  it.each([
    ["a DRAFT", detailRow],
    ["a PUBLISHED", { ...publishedRow, content: "Published body" }],
  ])("lets internal users read %s article", async (_label, row) => {
    mocks.findUnique.mockResolvedValue(row);
    const response = await request(app).get(`/api/knowledge-articles/${row.id}`).set(auth(agentToken));
    expect(response.status).toBe(200);
    expect(response.body.data.content).toBe(row.content);
    expect(response.body.data.createdBy).toEqual(author);
    expect(response.body.data.createdBy).not.toHaveProperty("email");
  });

  it("bounds and computes list pagination", async () => {
    const rejected = await request(app).get("/api/knowledge-articles?limit=500").set(auth(adminToken));
    expect(rejected.status).toBe(400);
    mocks.findMany.mockResolvedValue([draftRow]);
    mocks.count.mockResolvedValue(21);
    const response = await request(app).get("/api/knowledge-articles?page=2&limit=10").set(auth(adminToken));
    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
  });

  it("searches across title, content, and category", async () => {
    await request(app).get("/api/knowledge-articles?search=refund").set(auth(adminToken));
    const where = mocks.findMany.mock.calls[0]?.[0].where;
    expect(where.AND[0].OR).toEqual([
      { title: { contains: "refund", mode: "insensitive" } },
      { content: { contains: "refund", mode: "insensitive" } },
      { category: { contains: "refund", mode: "insensitive" } },
    ]);
  });

  it("filters by exact status and trimmed category", async () => {
    await request(app).get("/api/knowledge-articles?status=PUBLISHED&category=%20Billing%20").set(auth(managerToken));
    expect(mocks.findMany.mock.calls[0]?.[0].where).toMatchObject({ status: "PUBLISHED", category: "Billing" });
    const invalid = await request(app).get("/api/knowledge-articles?status=ARCHIVED").set(auth(managerToken));
    expect(invalid.status).toBe(400);
  });

  it("orders deterministically and uses a safe list projection", async () => {
    await request(app).get("/api/knowledge-articles").set(auth(adminToken));
    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
    expect(call.select).toEqual({
      id: true, title: true, category: true, status: true, createdAt: true, updatedAt: true,
      createdBy: { select: { id: true, name: true, role: true } },
    });
    expect(call.select).not.toHaveProperty("content");
  });

  it("returns a structured 404 for a missing internal article", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).get("/api/knowledge-articles/cffa63583dfa6706b87d284b8").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
  });

  it.each([
    ["ADMIN draft", adminToken, { title: "New guide", content: "Body" }, KnowledgeArticleStatus.DRAFT],
    ["ADMIN published", adminToken, { title: "New guide", content: "Body", status: "PUBLISHED" }, KnowledgeArticleStatus.PUBLISHED],
    ["MANAGER", managerToken, { title: "New guide", content: "Body" }, KnowledgeArticleStatus.DRAFT],
  ] as const)("lets %s create an article with server-derived author", async (_label, value, body, expectedStatus) => {
    mocks.create.mockResolvedValue({ ...detailRow, status: expectedStatus });
    const response = await request(app).post("/api/knowledge-articles").set(auth(value)).send(body);
    expect(response.status).toBe(201);
    const data = mocks.create.mock.calls[0]?.[0].data;
    expect(data.status).toBe(expectedStatus);
    expect(data.createdById).toBe(value === adminToken ? "c90b1b286043f1b7612e423c7" : "c6fd0a01a46ed4545f0a5e774");
  });

  it("trims textual input and defaults status to DRAFT", async () => {
    mocks.create.mockResolvedValue(detailRow);
    await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send({ title: "  Spaced title  ", content: "  Body  ", category: "  " });
    expect(mocks.create.mock.calls[0]?.[0].data).toMatchObject({ title: "Spaced title", content: "Body", category: null, status: "DRAFT" });
  });

  it("rejects a client-provided createdById and unknown creation fields", async () => {
    const withCreator = await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send({ title: "A valid title", content: "Body", createdById: "someone-else" });
    expect(withCreator.status).toBe(400);
    const withUnknown = await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send({ title: "A valid title", content: "Body", slug: "c2d711642b726b04401627ca9" });
    expect(withUnknown.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    ["AGENT", agentToken],
    ["CUSTOMER", customerToken],
  ])("returns 403 when %s creates an article", async (_role, value) => {
    const response = await request(app).post("/api/knowledge-articles").set(auth(value)).send({ title: "A valid title", content: "Body" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("validates required fields and length bounds", async () => {
    for (const body of [
      { title: "no", content: "Body" },
      { title: "A valid title", content: "" },
      { title: "c2d711642b726b04401627ca9".repeat(201), content: "Body" },
      { title: "A valid title", content: "y".repeat(50_001) },
      { title: "A valid title", content: "Body", category: "c".repeat(101) },
    ]) {
      const response = await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send(body);
      expect(response.status).toBe(400);
    }
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken]])("lets %s update allowed fields", async (_role, value) => {
    mocks.findUnique.mockResolvedValue({ id: "c529719cff715afea0ab75878" });
    mocks.update.mockResolvedValue({ ...detailRow, title: "Updated title" });
    const response = await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(value)).send({ title: "Updated title", category: "Accounts" });
    expect(response.status).toBe(200);
    expect(mocks.update.mock.calls[0]?.[0].data).toEqual({ title: "Updated title", category: "Accounts" });
  });

  it.each([
    ["publishes a draft", "PUBLISHED"],
    ["returns a published article to draft", "DRAFT"],
  ])("%s and never replaces the creator", async (_label, status) => {
    mocks.findUnique.mockResolvedValue({ id: "c529719cff715afea0ab75878" });
    mocks.update.mockResolvedValue({ ...detailRow, status });
    const response = await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ status });
    expect(response.status).toBe(200);
    const data = mocks.update.mock.calls[0]?.[0].data;
    expect(data).toEqual({ status });
    expect(data).not.toHaveProperty("createdById");
  });

  it("rejects an empty PATCH and forbidden or unknown update fields", async () => {
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({})).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ createdById: "c2d711642b726b04401627ca9" })).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ id: "c2d711642b726b04401627ca9" })).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ createdAt: "2020-01-01" })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns 403 when AGENT updates an article", async () => {
    const response = await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(agentToken)).send({ title: "A valid title" });
    expect(response.status).toBe(403);
  });

  it("returns 404 when the update target is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).patch("/api/knowledge-articles/cffa63583dfa6706b87d284b8").set(auth(adminToken)).send({ title: "A valid title" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken]])("lets %s delete an article", async (_role, value) => {
    mocks.findUnique.mockResolvedValue({ id: "c529719cff715afea0ab75878" });
    mocks.remove.mockResolvedValue({ id: "c529719cff715afea0ab75878" });
    const response = await request(app).delete("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(value));
    expect(response.status).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: "c529719cff715afea0ab75878" } });
  });

  it("returns 403 when AGENT deletes an article", async () => {
    expect((await request(app).delete("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(agentToken))).status).toBe(403);
  });

  it("returns 404 when the delete target is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).delete("/api/knowledge-articles/cffa63583dfa6706b87d284b8").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
  });
});
