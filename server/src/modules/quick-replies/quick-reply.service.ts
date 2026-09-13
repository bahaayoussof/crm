import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { AppError } from "../../shared/errors/app-error.js";
import { replyHtmlToPlainText, sanitizeReplyHtml } from "../../shared/rich-text/reply-html.js";
import type { CreateQuickReplyInput, QuickReplyListQuery, UpdateQuickReplyInput } from "./quick-reply.schema.js";

const authorSelect = { select: { id: true, name: true, role: true } } satisfies Prisma.UserDefaultArgs;

/** Readable-text ceiling enforced against the flattened body — the Zod `body`
 * bound is a larger transport limit that only caps raw markup size. */
const BODY_TEXT_MAX = 5_000;

/**
 * The single server-side trusted transform for an incoming Quick Reply body:
 * sanitize to the reply-composer HTML allowlist (same allowlist the ticket
 * reply/note editor writes — a Quick Reply is inserted straight into that
 * composer), then derive its plain-text projection. Rejects a body that is
 * empty once markup is stripped, or whose readable text exceeds the ceiling.
 * A legacy plain-text body sanitizes to itself unchanged.
 */
function prepareQuickReplyBody(raw: string): string {
  const body = sanitizeReplyHtml(raw);
  const bodyText = replyHtmlToPlainText(body);
  if (!bodyText) {
    throw new AppError(400, "VALIDATION_ERROR", "Quick reply body is required");
  }
  if (bodyText.length > BODY_TEXT_MAX) {
    throw new AppError(400, "VALIDATION_ERROR", "Quick reply body is too long");
  }
  return body;
}

const quickReplySelect = {
  id: true, title: true, body: true, createdAt: true, updatedAt: true,
  createdBy: authorSelect,
} satisfies Prisma.QuickReplySelect;

function searchWhere(search: string): Prisma.QuickReplyWhereInput {
  return { OR: [
    { title: { contains: search, mode: "insensitive" } },
    { body: { contains: search, mode: "insensitive" } },
  ] };
}

function notFound() {
  return new AppError(404, "QUICK_REPLY_NOT_FOUND", "Quick reply not found");
}

export async function listQuickReplies(query: QuickReplyListQuery) {
  const where: Prisma.QuickReplyWhereInput = {
    ...(query.search && { AND: [searchWhere(query.search)] }),
  };
  const [records, total] = await prisma.$transaction([
    prisma.quickReply.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ title: "asc" }, { id: "asc" }], select: quickReplySelect,
    }),
    prisma.quickReply.count({ where }),
  ]);
  return { data: records, meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
}

export async function getQuickReply(id: string) {
  const record = await prisma.quickReply.findUnique({ where: { id }, select: quickReplySelect });
  if (!record) throw notFound();
  return record;
}

export async function createQuickReply(
  input: CreateQuickReplyInput,
  actor: { userId: string },
  requestContext?: AuditRequestContext,
) {
  const body = prepareQuickReplyBody(input.body);
  // Mirrors createKnowledgeArticle/createDepartment: the insert and its
  // AuditLog row commit in one transaction, so a failed audit write rolls the
  // quick reply back and a successful create always has exactly one
  // QUICK_REPLY_CREATED row. The body itself never enters the audit record —
  // only the safe identifying title.
  return prisma.$transaction(async (tx) => {
    const quickReply = await tx.quickReply.create({
      data: { title: input.title, body, createdById: actor.userId },
      select: quickReplySelect,
    });
    await createAuditLog(
      {
        actorId: actor.userId,
        action: AUDIT_ACTIONS.QUICK_REPLY_CREATED,
        entityType: AUDIT_ENTITY_TYPES.QUICK_REPLY,
        entityId: quickReply.id,
        changes: { title: { to: quickReply.title } },
        requestContext,
      },
      tx,
    );
    return quickReply;
  });
}

export async function updateQuickReply(
  id: string,
  input: UpdateQuickReplyInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const existing = await prisma.quickReply.findUnique({ where: { id }, select: { id: true, title: true, body: true } });
  if (!existing) throw notFound();

  const data: Prisma.QuickReplyUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  // Same trusted transform as create: sanitized HTML persisted, may normalize a
  // legacy plain-text body to HTML on first edit (lazy conversion — audited as
  // a normal edit, not a distinct action).
  if (input.body !== undefined) data.body = prepareQuickReplyBody(input.body);

  // The update and its (conditional) AuditLog row commit in one transaction,
  // mirroring updateKnowledgeArticle/updateDepartment: a failed audit write
  // rolls the edit back, and a meaningful edit never commits unaudited.
  return prisma.$transaction(async (tx) => {
    const quickReply = await tx.quickReply.update({ where: { id }, data, select: quickReplySelect });

    // Title carries a real from/to via changedFields; a body change is
    // recorded as a presence-only marker — never the body text, an excerpt,
    // or a diff. `body`/`content` is never passed to changedFields.
    const changes = changedFields(existing, quickReply, ["title"]);
    const bodyChanged = existing.body !== quickReply.body;
    if (Object.keys(changes).length || bodyChanged) {
      await createAuditLog(
        {
          actorId,
          action: AUDIT_ACTIONS.QUICK_REPLY_UPDATED,
          entityType: AUDIT_ENTITY_TYPES.QUICK_REPLY,
          entityId: id,
          changes,
          metadata: bodyChanged ? { bodyChanged: true } : undefined,
          requestContext,
        },
        tx,
      );
    }
    return quickReply;
  });
}

export async function deleteQuickReply(id: string, actorId: string, requestContext?: AuditRequestContext) {
  const existing = await prisma.quickReply.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!existing) throw notFound();

  // Hard delete + its AuditLog row commit in one transaction, mirroring
  // deleteKnowledgeArticle/deleteDepartment: a failed audit write rolls the
  // delete back, so a successful hard delete always has exactly one
  // QUICK_REPLY_DELETED row. The body is never read for this snapshot.
  await prisma.$transaction(async (tx) => {
    await tx.quickReply.delete({ where: { id } });
    await createAuditLog(
      {
        actorId,
        action: AUDIT_ACTIONS.QUICK_REPLY_DELETED,
        entityType: AUDIT_ENTITY_TYPES.QUICK_REPLY,
        entityId: id,
        changes: { title: { from: existing.title } },
        requestContext,
      },
      tx,
    );
  });
}
