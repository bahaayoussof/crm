import { KnowledgeArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { articleHtmlToPlainText, sanitizeArticleHtml } from "../../shared/rich-text/reply-html.js";
import type {
  CreateKnowledgeArticleInput,
  KnowledgeArticleListQuery,
  PortalKnowledgeArticleListQuery,
  UpdateKnowledgeArticleInput,
} from "./knowledge-article.schema.js";

const authorSelect = { select: { id: true, name: true, role: true } } satisfies Prisma.UserDefaultArgs;

const listSelect = {
  id: true, title: true, category: true, status: true, createdAt: true, updatedAt: true,
  createdBy: authorSelect,
} satisfies Prisma.KnowledgeArticleSelect;

const detailSelect = {
  id: true, title: true, content: true, category: true, status: true, createdAt: true, updatedAt: true,
  createdBy: authorSelect,
} satisfies Prisma.KnowledgeArticleSelect;

const portalDetailSelect = {
  id: true, title: true, content: true, category: true, updatedAt: true,
} satisfies Prisma.KnowledgeArticleSelect;

const EXCERPT_MAX = 200;
/** Readable-text ceiling enforced against the flattened body (RT-1.6). The Zod
 * `content` bound is a larger transport limit that only caps raw markup size. */
const CONTENT_TEXT_MAX = 50_000;

export function deriveExcerpt(content: string | null, max = EXCERPT_MAX) {
  const normalized = (content ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
}

/**
 * The single server-side trusted transform for an incoming article body:
 * sanitize to the V1 HTML allowlist, then derive the canonical plain-text
 * projection. Rejects a body that is empty once markup is stripped, or whose
 * readable text exceeds the plain-text ceiling — reusing the existing
 * `AppError(400, "VALIDATION_ERROR")` shape (no new error code).
 */
function prepareArticleBody(raw: string): { content: string; contentText: string } {
  const content = sanitizeArticleHtml(raw);
  const contentText = articleHtmlToPlainText(content);
  if (!contentText) {
    throw new AppError(400, "VALIDATION_ERROR", "Knowledge article content is required");
  }
  if (contentText.length > CONTENT_TEXT_MAX) {
    throw new AppError(400, "VALIDATION_ERROR", "Knowledge article content is too long");
  }
  return { content, contentText };
}

function searchWhere(search: string): Prisma.KnowledgeArticleWhereInput {
  return { OR: [
    { title: { contains: search, mode: "insensitive" } },
    // Search matches the human-readable projection, never raw markup (RT-5.1).
    { contentText: { contains: search, mode: "insensitive" } },
    { category: { contains: search, mode: "insensitive" } },
  ] };
}

function notFound() {
  return new AppError(404, "KNOWLEDGE_ARTICLE_NOT_FOUND", "Knowledge article not found");
}

export async function listKnowledgeArticles(query: KnowledgeArticleListQuery) {
  const where: Prisma.KnowledgeArticleWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.category && { category: query.category.trim() }),
    ...(query.search && { AND: [searchWhere(query.search)] }),
  };
  const [records, total] = await prisma.$transaction([
    prisma.knowledgeArticle.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: listSelect,
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return { data: records, meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
}

export async function getKnowledgeArticle(id: string) {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id }, select: detailSelect });
  if (!article) throw notFound();
  return article;
}

export async function createKnowledgeArticle(
  input: CreateKnowledgeArticleInput,
  actor: { userId: string },
  requestContext?: AuditRequestContext,
) {
  // Mirrors createDepartment: the article insert and its AuditLog row commit in
  // one transaction, so a failed audit write rolls the article back and a
  // successful create always has exactly one KNOWLEDGE_ARTICLE_CREATED row.
  // Server is the trust boundary: sanitize the body to the V1 HTML allowlist and
  // derive its canonical plain-text projection before persisting. Runs outside
  // the transaction — a rejected body must not open one.
  const { content, contentText } = prepareArticleBody(input.content);
  return prisma.$transaction(async (tx) => {
    const article = await tx.knowledgeArticle.create({
      data: {
        title: input.title,
        content,
        contentText,
        category: input.category ?? null,
        status: input.status,
        createdById: actor.userId,
      },
      select: detailSelect,
    });
    // Safe identifying scalars only — the article body (content) is never
    // placed in the audit record in any form.
    await createAuditLog(
      {
        actorId: actor.userId,
        action: AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_CREATED,
        entityType: AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE,
        entityId: article.id,
        changes: {
          title: { to: article.title },
          category: { to: article.category },
          status: { to: article.status },
        },
        requestContext,
      },
      tx,
    );
    return article;
  });
}

export async function updateKnowledgeArticle(
  id: string,
  input: UpdateKnowledgeArticleInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  // Pre-check stays outside the transaction (mirrors updateDepartment). The
  // widened select supplies the `before` snapshot for meaningful-change
  // detection; `content` is read only to diff it, never to store it.
  const existing = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: { id: true, title: true, content: true, category: true, status: true },
  });
  if (!existing) throw notFound();

  const data: Prisma.KnowledgeArticleUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) {
    // Same trusted transform as create: sanitized HTML in `content`, derived
    // plain text in `contentText`. May normalize a legacy plain-text body to
    // HTML on first edit (BC — lazy conversion, audited as a normal edit).
    const prepared = prepareArticleBody(input.content);
    data.content = prepared.content;
    data.contentText = prepared.contentText;
  }
  if (input.category !== undefined) data.category = input.category;
  if (input.status !== undefined) data.status = input.status;

  // The article update and its (conditional) AuditLog row commit in one
  // transaction: a failed audit write rolls the edit back, and a meaningful
  // edit never commits unaudited (mirrors updateDepartment).
  return prisma.$transaction(async (tx) => {
    const article = await tx.knowledgeArticle.update({ where: { id }, data, select: detailSelect });

    // Safe bounded scalars (title, category, status) carry real from/to via
    // changedFields; a content change is recorded as a presence-only marker —
    // never the body text, an excerpt, a diff, a hash, or a length. `content`
    // is never passed to changedFields and never appears in `changes`.
    const changes = changedFields(existing, article, ["title", "category", "status"]);
    const contentChanged = existing.content !== article.content;
    if (Object.keys(changes).length || contentChanged) {
      // KB-AUDIT-005: a genuine DRAFT ⇄ PUBLISHED transition (changedFields
      // only sets `status` when before !== after) selects the lifecycle
      // action and takes precedence over the generic UPDATED action even when
      // title/category/content also changed in the same PATCH — mirrors the
      // isActive → ACTIVATED/DEACTIVATED branch in updateDepartment. A
      // same-status PATCH leaves `changes.status` unset and falls through to
      // UPDATED / no-op suppression.
      const action =
        changes.status !== undefined
          ? article.status === KnowledgeArticleStatus.PUBLISHED
            ? AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_PUBLISHED
            : AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_UNPUBLISHED
          : AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_UPDATED;
      await createAuditLog(
        {
          actorId,
          action,
          entityType: AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE,
          entityId: id,
          changes,
          metadata: contentChanged ? { contentChanged: true } : undefined,
          requestContext,
        },
        tx,
      );
    }
    return article;
  });
}

export async function deleteKnowledgeArticle(id: string, actorId: string, requestContext?: AuditRequestContext) {
  // Pre-check stays outside the transaction (mirrors deleteDepartment). The
  // widened select captures a minimal pre-delete snapshot for the AuditLog,
  // since the row is gone once the delete commits; `content` is never read.
  const existing = await prisma.knowledgeArticle.findUnique({
    where: { id },
    select: { id: true, title: true, category: true, status: true },
  });
  if (!existing) throw notFound();

  // Hard delete + its AuditLog row commit in one transaction: a failed audit
  // write rolls the delete back, so a successful hard delete always has exactly
  // one KNOWLEDGE_ARTICLE_DELETED row (mirrors deleteDepartment). Delete stays a
  // permanent hard delete — no archive / soft delete / restore.
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeArticle.delete({ where: { id } });
    // Safe identifying scalars only — the article body (content) is never
    // placed in the audit record in any form.
    await createAuditLog(
      {
        actorId,
        action: AUDIT_ACTIONS.KNOWLEDGE_ARTICLE_DELETED,
        entityType: AUDIT_ENTITY_TYPES.KNOWLEDGE_ARTICLE,
        entityId: id,
        changes: {
          title: { from: existing.title },
          category: { from: existing.category },
          status: { from: existing.status },
        },
        requestContext,
      },
      tx,
    );
  });
}

export async function listPublishedKnowledgeArticles(query: PortalKnowledgeArticleListQuery) {
  const where: Prisma.KnowledgeArticleWhereInput = {
    status: KnowledgeArticleStatus.PUBLISHED,
    ...(query.category && { category: query.category.trim() }),
    ...(query.search && { AND: [searchWhere(query.search)] }),
  };
  const [records, total] = await prisma.$transaction([
    prisma.knowledgeArticle.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      // `excerpt` is a server-derived, plain, length-bounded string — customers
      // never receive markup in the list (RT-7.4).
      select: { id: true, title: true, category: true, contentText: true, updatedAt: true },
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return {
    data: records.map(({ contentText, ...rest }) => ({ ...rest, excerpt: deriveExcerpt(contentText) })),
    meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
  };
}

export async function getPublishedKnowledgeArticle(id: string) {
  const article = await prisma.knowledgeArticle.findFirst({
    where: { id, status: KnowledgeArticleStatus.PUBLISHED },
    select: portalDetailSelect,
  });
  if (!article) throw notFound();
  return article;
}
