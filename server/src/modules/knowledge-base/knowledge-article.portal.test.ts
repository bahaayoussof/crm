import { KnowledgeArticleStatus, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() }));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    knowledgeArticle: { findMany: mocks.findMany, count: mocks.count, findFirst: mocks.findFirst },
    $transaction: vi.fn(async (value: unknown) =>
      typeof value === "function" ? (value as (tx: unknown) => unknown)(mocks) : Promise.all(value as Promise<unknown>[])),
  },
}));

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (id: string, role: Role) => createAccessToken({ id, role });
const customerToken = token("customer-1", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const now = new Date("2026-08-26T12:00:00.000Z");
const publishedRow = { id: "article-pub", title: "Billing FAQ", category: "Billing", content: "  How billing   works in detail.  ", updatedAt: now };

describe("customer portal knowledge base API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it("lets a CUSTOMER list published portal articles", async () => {
    mocks.findMany.mockResolvedValue([publishedRow]);
    mocks.count.mockResolvedValue(1);
    const response = await request(app).get("/api/portal/knowledge-articles").set(auth(customerToken));
    expect(response.status).toBe(200);
    expect(response.body.data[0]).toEqual({ id: "article-pub", title: "Billing FAQ", category: "Billing", updatedAt: now.toISOString(), excerpt: "How billing works in detail." });
    expect(response.body.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it("always enforces PUBLISHED status and never accepts a requested status", async () => {
    await request(app).get("/api/portal/knowledge-articles").set(auth(customerToken));
    expect(mocks.findMany.mock.calls[0]?.[0].where).toMatchObject({ status: KnowledgeArticleStatus.PUBLISHED });
    const withStatus = await request(app).get("/api/portal/knowledge-articles?status=DRAFT").set(auth(customerToken));
    expect(withStatus.status).toBe(400);
  });

  it("keeps portal search and category filtering published-only and deterministic", async () => {
    await request(app).get("/api/portal/knowledge-articles?search=refund&category=%20Billing%20").set(auth(customerToken));
    const call = mocks.findMany.mock.calls[0]?.[0];
    expect(call.where.status).toBe(KnowledgeArticleStatus.PUBLISHED);
    expect(call.where.category).toBe("Billing");
    expect(call.where.AND[0].OR).toEqual([
      { title: { contains: "refund", mode: "insensitive" } },
      { content: { contains: "refund", mode: "insensitive" } },
      { category: { contains: "refund", mode: "insensitive" } },
    ]);
    expect(call.orderBy).toEqual([{ updatedAt: "desc" }, { id: "asc" }]);
  });

  it("returns a published portal article with a status-free author-free projection", async () => {
    mocks.findFirst.mockResolvedValue({ id: "article-pub", title: "Billing FAQ", content: "Body", category: "Billing", updatedAt: now });
    const response = await request(app).get("/api/portal/knowledge-articles/article-pub").set(auth(customerToken));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: "article-pub", title: "Billing FAQ", content: "Body", category: "Billing", updatedAt: now.toISOString() });
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "article-pub", status: KnowledgeArticleStatus.PUBLISHED } }));
    for (const field of ["status", "createdBy", "author", "createdById", "createdAt"]) expect(response.body.data).not.toHaveProperty(field);
  });

  it("returns the same structured 404 for a draft and for a missing portal article", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const draft = await request(app).get("/api/portal/knowledge-articles/article-draft").set(auth(customerToken));
    const missing = await request(app).get("/api/portal/knowledge-articles/does-not-exist").set(auth(customerToken));
    expect(draft.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(draft.body).toEqual(missing.body);
    expect(draft.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
  });

  it("rejects unauthenticated and internal-role access to portal knowledge base routes", async () => {
    expect((await request(app).get("/api/portal/knowledge-articles")).status).toBe(401);
    for (const role of [Role.ADMIN, Role.MANAGER, Role.AGENT]) {
      expect((await request(app).get("/api/portal/knowledge-articles").set(auth(token("staff", role)))).status).toBe(403);
      expect((await request(app).get("/api/portal/knowledge-articles/article-pub").set(auth(token("staff", role)))).status).toBe(403);
    }
  });
});
