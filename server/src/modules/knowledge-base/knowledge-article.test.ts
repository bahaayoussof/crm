import { KnowledgeArticleStatus, Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), auditCreate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const knowledgeArticle = {
    findMany: mocks.findMany, count: mocks.count, findUnique: mocks.findUnique,
    findFirst: mocks.findFirst, create: mocks.create, update: mocks.update, delete: mocks.remove,
  };
  const auditLog = { create: mocks.auditCreate };
  return {
    prisma: {
      knowledgeArticle,
      auditLog,
      $transaction: vi.fn(async (value: unknown) =>
        typeof value === "function"
          ? (value as (tx: unknown) => unknown)({ knowledgeArticle, auditLog })
          : Promise.all(value as Promise<unknown>[])),
    },
  };
});

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

  it("rejects unauthenticated internal knowledge base requests (read and mutation) with no audit row", async () => {
    const id = "c2d711642b726b04401627ca9";
    expect((await request(app).get("/api/knowledge-articles")).status).toBe(401);
    expect((await request(app).post("/api/knowledge-articles").send({ title: "A valid title", content: "Body" })).status).toBe(401);
    expect((await request(app).patch(`/api/knowledge-articles/${id}`).send({ title: "A valid title" })).status).toBe(401);
    expect((await request(app).delete(`/api/knowledge-articles/${id}`)).status).toBe(401);
    // No auth context ⇒ rejected before the service ⇒ no successful mutation ⇒ no audit row.
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects CUSTOMER from every internal knowledge base route", async () => {
    expect((await request(app).get("/api/knowledge-articles").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/knowledge-articles").set(auth(customerToken)).send({ title: "A valid title", content: "Body" })).status).toBe(403);
    expect((await request(app).patch("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken)).send({ title: "A valid title" })).status).toBe(403);
    expect((await request(app).delete("/api/knowledge-articles/c2d711642b726b04401627ca9").set(auth(customerToken))).status).toBe(403);
    // CUSTOMER blocked at the RBAC boundary on every internal mutation ⇒ no audit row.
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it.each([["ADMIN", adminToken], ["MANAGER", managerToken], ["AGENT", agentToken]] as const)(
    "allows %s to list all articles", async (_role, value) => {
      mocks.findMany.mockResolvedValue([draftRow, publishedRow]);
      mocks.count.mockResolvedValue(2);
      const response = await request(app).get("/api/knowledge-articles").set(auth(value));
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(mocks.auditCreate).not.toHaveBeenCalled(); // listing is a read — never audited
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
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // reading a detail is never audited
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

  it("searches across title, human-readable body text, and category", async () => {
    await request(app).get("/api/knowledge-articles?search=refund").set(auth(adminToken));
    const where = mocks.findMany.mock.calls[0]?.[0].where;
    expect(where.AND[0].OR).toEqual([
      { title: { contains: "refund", mode: "insensitive" } },
      { contentText: { contains: "refund", mode: "insensitive" } },
      { category: { contains: "refund", mode: "insensitive" } },
    ]);
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // internal search is a read — never audited
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
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // a missing read target is still a read
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

  it("writes exactly one transactional KNOWLEDGE_ARTICLE_CREATED audit row with no article body", async () => {
    const body = "Confidential internal body that must never reach the audit log.";
    const created = {
      ...detailRow,
      id: "cnew00000000000000000000a",
      title: "Onboarding guide",
      category: "Accounts",
      status: KnowledgeArticleStatus.DRAFT,
      content: body,
    };
    mocks.create.mockResolvedValue(created);

    const response = await request(app)
      .post("/api/knowledge-articles")
      .set(auth(adminToken))
      .send({ title: "Onboarding guide", content: body, category: "Accounts" });

    expect(response.status).toBe(201);
    expect(response.body.data.content).toBe(body); // response contract unchanged
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);

    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData).toMatchObject({
      action: "KNOWLEDGE_ARTICLE_CREATED",
      entityType: "KNOWLEDGE_ARTICLE",
      entityId: created.id,
      actorId: "c90b1b286043f1b7612e423c7",
    });
    expect(auditData).toHaveProperty("ipAddress");
    expect(auditData).toHaveProperty("userAgent");
    expect(auditData.metadata.changes).toEqual({
      title: { to: "Onboarding guide" },
      category: { to: "Accounts" },
      status: { to: "DRAFT" },
    });
    expect(auditData.metadata).not.toHaveProperty("contentChanged"); // no "before" on create
    // Content-leak check: the body appears nowhere in the serialized audit payload.
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata).not.toHaveProperty("content");
    expect(JSON.stringify(auditData)).not.toContain(body);
  });

  // KB-RICH-003 — server sanitizes the body to the V1 HTML allowlist and stores
  // its plain-text projection; neither derived value ever enters the audit row.
  it("stores sanitized HTML in content and its plain text in contentText, neutralizing XSS", async () => {
    mocks.create.mockResolvedValue({ ...detailRow, id: "crich0000000000000000000a" });
    const response = await request(app)
      .post("/api/knowledge-articles")
      .set(auth(adminToken))
      .send({
        title: "Formatted guide",
        content:
          '<h2>Step one</h2><p>Do <strong>this</strong> safely.</p>' +
          '<script>alert(1)</script><img src="x" onerror="y()">' +
          '<a href="javascript:alert(1)">bad</a>',
      });
    expect(response.status).toBe(201);
    const data = mocks.create.mock.calls[0]?.[0].data;
    expect(data.content).toContain("<h2>Step one</h2>");
    expect(data.content).toContain("<strong>this</strong>");
    expect(data.content).not.toMatch(/<script|onerror|javascript:|<img/);
    // Flattened plain text: markup gone, readable words kept (the unsafe link's
    // href is dropped but its visible text survives).
    expect(data.contentText).toContain("Step one");
    expect(data.contentText).toContain("Do this safely.");
    expect(data.contentText).not.toMatch(/[<>]|javascript:/);
    // The audit row carries no body value in any form.
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(JSON.stringify(auditData)).not.toContain("Step one");
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata).not.toHaveProperty("contentText");
  });

  it("rejects a body that is empty once markup is stripped with a 400 and no audit row", async () => {
    const response = await request(app)
      .post("/api/knowledge-articles")
      .set(auth(adminToken))
      .send({ title: "Empty after sanitize", content: "<script>alert(1)</script><span></span>" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("normalizes a legacy plain-text body to HTML on edit as one KNOWLEDGE_ARTICLE_UPDATED with no body leak", async () => {
    const legacy = { ...editSnapshot, content: "Legacy line one.\n\nLegacy line two." };
    mocks.findUnique.mockResolvedValue(legacy);
    mocks.update.mockResolvedValue({ ...detailRow, content: "<p>Legacy line one.</p><p>Legacy line two.</p>" });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ content: "<p>Legacy line one.</p><p>Legacy line two rewritten.</p>" });
    expect(response.status).toBe(200);
    const data = mocks.update.mock.calls[0]?.[0].data;
    expect(data.content).toMatch(/^<p>/);
    expect(data.contentText).toBe("Legacy line one.\nLegacy line two rewritten.");
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_UPDATED");
    expect(auditData.metadata.contentChanged).toBe(true);
    expect(JSON.stringify(auditData)).not.toContain("Legacy line one");
  });

  it("rejects a client-provided createdById and unknown creation fields", async () => {
    const withCreator = await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send({ title: "A valid title", content: "Body", createdById: "someone-else" });
    expect(withCreator.status).toBe(400);
    const withUnknown = await request(app).post("/api/knowledge-articles").set(auth(adminToken)).send({ title: "A valid title", content: "Body", slug: "c2d711642b726b04401627ca9" });
    expect(withUnknown.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // validation rejects before the service ⇒ no audit
  });

  it.each([
    ["AGENT", agentToken],
    ["CUSTOMER", customerToken],
  ])("returns 403 when %s creates an article", async (_role, value) => {
    const response = await request(app).post("/api/knowledge-articles").set(auth(value)).send({ title: "A valid title", content: "Body" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // RBAC rejects the create ⇒ no audit row
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
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // invalid create payloads never reach an auditable mutation
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

  // KB-AUDIT-004 — meaningful non-lifecycle edits (title / content / category).
  const editSnapshot = {
    id: "c529719cff715afea0ab75878",
    title: "Reset a password",
    content: "Full article content for internal readers.",
    category: "Accounts",
    status: KnowledgeArticleStatus.DRAFT,
  };

  it("audits a title-only edit as exactly one KNOWLEDGE_ARTICLE_UPDATED row with no body", async () => {
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue({ ...detailRow, title: "Reset your password" });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ title: "Reset your password" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData).toMatchObject({
      action: "KNOWLEDGE_ARTICLE_UPDATED",
      entityType: "KNOWLEDGE_ARTICLE",
      entityId: "c529719cff715afea0ab75878",
      actorId: "c90b1b286043f1b7612e423c7",
    });
    expect(auditData).toHaveProperty("ipAddress");
    expect(auditData).toHaveProperty("userAgent");
    expect(auditData.action).not.toBe("KNOWLEDGE_ARTICLE_PUBLISHED"); // no lifecycle action
    expect(auditData.action).not.toBe("KNOWLEDGE_ARTICLE_UNPUBLISHED");
    expect(auditData.metadata.changes).toEqual({
      title: { from: "Reset a password", to: "Reset your password" },
    });
    expect(auditData.metadata.changes).not.toHaveProperty("status");
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata).not.toHaveProperty("contentChanged");
  });

  it("audits a content-only edit with a presence marker and never stores the body", async () => {
    const oldBody = editSnapshot.content;
    const newBody = "Rewritten confidential body that must never reach the audit log.";
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue({ ...detailRow, content: newBody });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ content: newBody });
    expect(response.status).toBe(200);
    expect(response.body.data.content).toBe(newBody); // response contract unchanged
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_UPDATED");
    expect(auditData.metadata.contentChanged).toBe(true);
    expect(auditData.metadata).not.toHaveProperty("changes");
    // Content-leak check: neither the old nor the new body appears in the payload.
    expect(JSON.stringify(auditData)).not.toContain(newBody);
    expect(JSON.stringify(auditData)).not.toContain(oldBody);
  });

  it.each([
    ["null to a value", null, "Billing", { from: null, to: "Billing" }],
    ["a value to null", "Billing", null, { from: "Billing", to: null }],
    ["one value to another", "Billing", "Payments", { from: "Billing", to: "Payments" }],
  ])("audits a category change from %s", async (_label, before, after, expected) => {
    mocks.findUnique.mockResolvedValue({ ...editSnapshot, category: before });
    mocks.update.mockResolvedValue({ ...detailRow, category: after });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ category: after ?? "" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.metadata.changes).toEqual({ category: expected });
    expect(auditData.metadata).not.toHaveProperty("contentChanged");
  });

  it("audits a combined title + category + content edit as exactly one row", async () => {
    const newBody = "New body text for the combined edit.";
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue({ ...detailRow, title: "Reset your password", category: "Security", content: newBody });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ title: "Reset your password", category: "Security", content: newBody });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData).toMatchObject({
      action: "KNOWLEDGE_ARTICLE_UPDATED", // one _UPDATED row, not one per field, no lifecycle action
      entityType: "KNOWLEDGE_ARTICLE",
      entityId: "c529719cff715afea0ab75878",
      actorId: "c90b1b286043f1b7612e423c7",
    });
    expect(auditData.metadata.changes).toEqual({
      title: { from: "Reset a password", to: "Reset your password" },
      category: { from: "Accounts", to: "Security" },
    });
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata.changes).not.toHaveProperty("status");
    expect(auditData.metadata.contentChanged).toBe(true);
    expect(JSON.stringify(auditData)).not.toContain(newBody);
  });

  it("writes no audit row for a no-op PATCH whose values equal the current row", async () => {
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue(detailRow);
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ title: "Reset a password" });
    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(detailRow.id);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  // KB-AUDIT-005 — DRAFT ⇄ PUBLISHED lifecycle audit through the same PATCH path.
  it("audits DRAFT → PUBLISHED as one KNOWLEDGE_ARTICLE_PUBLISHED row", async () => {
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue({ ...detailRow, status: KnowledgeArticleStatus.PUBLISHED });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ status: "PUBLISHED" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData).toMatchObject({
      action: "KNOWLEDGE_ARTICLE_PUBLISHED",
      entityType: "KNOWLEDGE_ARTICLE",
      entityId: "c529719cff715afea0ab75878",
      actorId: "c90b1b286043f1b7612e423c7",
    });
    expect(auditData.metadata.changes).toEqual({ status: { from: "DRAFT", to: "PUBLISHED" } });
    expect(auditData.metadata).not.toHaveProperty("contentChanged");
  });

  it("audits PUBLISHED → DRAFT as one KNOWLEDGE_ARTICLE_UNPUBLISHED row", async () => {
    mocks.findUnique.mockResolvedValue({ ...editSnapshot, status: KnowledgeArticleStatus.PUBLISHED });
    mocks.update.mockResolvedValue({ ...detailRow, status: KnowledgeArticleStatus.DRAFT });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ status: "DRAFT" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_UNPUBLISHED");
    expect(auditData.action).not.toBe("KNOWLEDGE_ARTICLE_PUBLISHED");
    expect(auditData.metadata.changes).toEqual({ status: { from: "PUBLISHED", to: "DRAFT" } });
  });

  it("lets the lifecycle action win over UPDATED on a combined title + publish PATCH", async () => {
    mocks.findUnique.mockResolvedValue(editSnapshot);
    mocks.update.mockResolvedValue({
      ...detailRow,
      title: "Reset your password",
      status: KnowledgeArticleStatus.PUBLISHED,
    });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ title: "Reset your password", status: "PUBLISHED" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_PUBLISHED");
    expect(auditData.action).not.toBe("KNOWLEDGE_ARTICLE_UPDATED"); // lifecycle wins over generic update
    expect(auditData.metadata.changes).toEqual({
      title: { from: "Reset a password", to: "Reset your password" },
      status: { from: "DRAFT", to: "PUBLISHED" },
    });
  });

  it("audits a combined content + unpublish PATCH as one _UNPUBLISHED row with no body", async () => {
    const oldBody = editSnapshot.content;
    const newBody = "Reworded confidential body that must never reach the audit log.";
    mocks.findUnique.mockResolvedValue({ ...editSnapshot, status: KnowledgeArticleStatus.PUBLISHED });
    mocks.update.mockResolvedValue({ ...detailRow, status: KnowledgeArticleStatus.DRAFT, content: newBody });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ content: newBody, status: "DRAFT" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_UNPUBLISHED");
    expect(auditData.action).not.toBe("KNOWLEDGE_ARTICLE_UPDATED"); // lifecycle wins; no second _UPDATED row
    expect(auditData.metadata.changes).toEqual({ status: { from: "PUBLISHED", to: "DRAFT" } });
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata.contentChanged).toBe(true);
    expect(JSON.stringify(auditData)).not.toContain(newBody);
    expect(JSON.stringify(auditData)).not.toContain(oldBody);
  });

  it("writes no audit row when a PATCH sets status to its current value", async () => {
    mocks.findUnique.mockResolvedValue({ ...editSnapshot, status: KnowledgeArticleStatus.PUBLISHED });
    mocks.update.mockResolvedValue({ ...detailRow, status: KnowledgeArticleStatus.PUBLISHED });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ status: "PUBLISHED" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("audits a same-status PATCH with a real title edit as KNOWLEDGE_ARTICLE_UPDATED, not a lifecycle action", async () => {
    mocks.findUnique.mockResolvedValue({ ...editSnapshot, status: KnowledgeArticleStatus.PUBLISHED });
    mocks.update.mockResolvedValue({
      ...detailRow,
      status: KnowledgeArticleStatus.PUBLISHED,
      title: "Reset your password",
    });
    const response = await request(app)
      .patch("/api/knowledge-articles/c529719cff715afea0ab75878")
      .set(auth(adminToken))
      .send({ status: "PUBLISHED", title: "Reset your password" });
    expect(response.status).toBe(200);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.action).toBe("KNOWLEDGE_ARTICLE_UPDATED");
    expect(auditData.metadata.changes).toEqual({
      title: { from: "Reset a password", to: "Reset your password" },
    });
    expect(auditData.metadata.changes).not.toHaveProperty("status");
  });

  it("rejects an empty PATCH and forbidden or unknown update fields", async () => {
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({})).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ createdById: "c2d711642b726b04401627ca9" })).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ id: "c2d711642b726b04401627ca9" })).status).toBe(400);
    expect((await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(adminToken)).send({ createdAt: "2020-01-01" })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // rejected payloads never produce an audit row
  });

  it("returns 403 when AGENT updates an article", async () => {
    const response = await request(app).patch("/api/knowledge-articles/c529719cff715afea0ab75878").set(auth(agentToken)).send({ title: "A valid title" });
    expect(response.status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // AGENT is read-only ⇒ no update, no audit
  });

  it("returns 404 when the update target is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).patch("/api/knowledge-articles/cffa63583dfa6706b87d284b8").set(auth(adminToken)).send({ title: "A valid title" });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // pre-check throws before the transaction ⇒ no audit
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
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled(); // AGENT cannot delete ⇒ no audit row
  });

  it("returns 404 when the delete target is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await request(app).delete("/api/knowledge-articles/cffa63583dfa6706b87d284b8").set(auth(adminToken));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("KNOWLEDGE_ARTICLE_NOT_FOUND");
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  // KB-AUDIT-006 — transactional audit for the existing hard-delete path.
  const deleteSnapshot = {
    id: "c529719cff715afea0ab75878",
    title: "Reset a password",
    category: "Accounts",
    status: KnowledgeArticleStatus.DRAFT,
  };

  it("writes exactly one transactional KNOWLEDGE_ARTICLE_DELETED audit row with safe pre-delete context", async () => {
    mocks.findUnique.mockResolvedValue(deleteSnapshot);
    mocks.remove.mockResolvedValue({ id: deleteSnapshot.id });
    const response = await request(app)
      .delete(`/api/knowledge-articles/${deleteSnapshot.id}`)
      .set(auth(adminToken));
    expect(response.status).toBe(204);
    expect(response.body).toEqual({}); // empty response contract unchanged
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id: deleteSnapshot.id } });
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData).toMatchObject({
      action: "KNOWLEDGE_ARTICLE_DELETED",
      entityType: "KNOWLEDGE_ARTICLE",
      entityId: deleteSnapshot.id,
      actorId: "c90b1b286043f1b7612e423c7",
    });
    expect(auditData).toHaveProperty("ipAddress");
    expect(auditData).toHaveProperty("userAgent");
    expect(auditData.metadata.changes).toEqual({
      title: { from: "Reset a password" },
      category: { from: "Accounts" },
      status: { from: "DRAFT" },
    });
    // delete happens within the same $transaction callback, before the audit write.
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.auditCreate.mock.invocationCallOrder[0],
    );
  });

  it("never stores the article body in the delete audit row", async () => {
    const body = "Confidential internal body that must never reach the audit log on delete.";
    mocks.findUnique.mockResolvedValue({ ...deleteSnapshot, content: body });
    mocks.remove.mockResolvedValue({ id: deleteSnapshot.id });
    const response = await request(app)
      .delete(`/api/knowledge-articles/${deleteSnapshot.id}`)
      .set(auth(adminToken));
    expect(response.status).toBe(204);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    const auditData = mocks.auditCreate.mock.calls[0]?.[0].data;
    expect(auditData.metadata.changes).not.toHaveProperty("content");
    expect(auditData.metadata).not.toHaveProperty("content");
    expect(JSON.stringify(auditData)).not.toContain(body);
  });

  // KB-AUDIT-009 — transaction atomicity / audit-failure rollback.
  //
  // createKnowledgeArticle, updateKnowledgeArticle, and deleteKnowledgeArticle
  // all use the identical shape: `prisma.$transaction(tx => { <mutate via tx>;
  // await createAuditLog(..., tx) })`. When the audit write rejects *inside*
  // that callback, the rejection propagates out of `$transaction` — the
  // service call rejects, the HTTP request fails with a 500, and no success
  // (2xx) response body is produced, i.e. the mutation cannot remain committed
  // while its audit row is lost. One parameterized case covers all three
  // mutations rather than three near-identical brittle tests.
  describe("a failing transactional audit write rejects the whole mutation", () => {
    const targetId = "c529719cff715afea0ab75878";
    const auditFailure = new Error("audit log write failed inside the transaction");

    beforeEach(() => {
      // The 500 path legitimately logs the propagated error; keep test output clean.
      vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.findUnique.mockResolvedValue({ ...editSnapshot, id: targetId });
      mocks.create.mockResolvedValue({ ...detailRow, id: "cnew00000000000000000000a" });
      mocks.update.mockResolvedValue({ ...detailRow, title: "Reset your password" });
      mocks.remove.mockResolvedValue({ id: targetId });
      // mockImplementation (not mockRejectedValue) so the rejected promise is
      // created only when the service actually calls createAuditLog, not eagerly
      // at hook-setup time.
      mocks.auditCreate.mockImplementation(async () => {
        throw auditFailure;
      });
    });

    it.each([
      [
        "create",
        () =>
          request(app)
            .post("/api/knowledge-articles")
            .set(auth(adminToken))
            .send({ title: "Onboarding guide", content: "Body" }),
      ],
      [
        "update",
        () =>
          request(app)
            .patch(`/api/knowledge-articles/${targetId}`)
            .set(auth(adminToken))
            .send({ title: "Reset your password" }),
      ],
      [
        "delete",
        () => request(app).delete(`/api/knowledge-articles/${targetId}`).set(auth(adminToken)),
      ],
    ] as const)("surfaces the audit failure and produces no success response for %s", async (_op, call) => {
      const response = await call();
      // The audit write was reached (inside the transaction)…
      expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
      // …and its rejection propagated out of $transaction: request failed,
      // no 2xx success contract was returned.
      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect([200, 201, 204]).not.toContain(response.status);
    });
  });
});
