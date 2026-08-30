import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import type { AuditChanges, } from "./audit-log.constants.js";
import type { AuditRequestContext } from "./audit-request-context.js";
import type { AuditLogQuery } from "./audit-log.schema.js";

type Db = typeof prisma | Prisma.TransactionClient;
type SafeMetadata = Record<string, string | number | boolean>;
export async function createAuditLog(input: { actorId: string | null; action: string; entityType: string; entityId?: string | null; changes?: AuditChanges; metadata?: SafeMetadata; requestContext?: AuditRequestContext }, db: Db = prisma) {
  const metadata: Record<string, Prisma.InputJsonValue> = { actorType: input.actorId ? "USER" : "SYSTEM" };
  if (input.changes && Object.keys(input.changes).length) metadata.changes = input.changes as Prisma.InputJsonObject;
  if (input.metadata) for (const [key, value] of Object.entries(input.metadata)) metadata[key] = value;
  return db.auditLog.create({ data: { actorId: input.actorId, action: input.action, entityType: input.entityType, entityId: input.entityId ?? null, metadata, ipAddress: input.requestContext?.ipAddress ?? null, userAgent: input.requestContext?.userAgent ?? null } });
}

export function changedFields<T extends Record<string, unknown>>(before: T, after: T, fields: readonly (keyof T)[]): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) if (before[field] !== after[field]) changes[String(field)] = { from: before[field] as never, to: after[field] as never };
  return changes;
}

export async function listAuditLogs(query: AuditLogQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(query.actorId && { actorId: query.actorId }), ...(query.action && { action: query.action }), ...(query.entityType && { entityType: query.entityType }), ...(query.entityId && { entityId: query.entityId }),
    ...((query.from || query.to) && { createdAt: { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) } }),
    ...(query.search && { OR: [{ action: { contains: query.search, mode: "insensitive" } }, { entityType: { contains: query.search, mode: "insensitive" } }, { entityId: { contains: query.search, mode: "insensitive" } }, { actor: { is: { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } } }] }),
  };
  const [rows, total] = await prisma.$transaction([prisma.auditLog.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, action: true, entityType: true, entityId: true, metadata: true, ipAddress: true, userAgent: true, createdAt: true, actor: { select: { id: true, name: true, email: true } } } }), prisma.auditLog.count({ where })]);
  return { data: rows.map(({ metadata, ...row }) => { const value = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {}; const changes = value.changes ?? {}; const safeMetadata = { ...value }; delete safeMetadata.changes; delete safeMetadata.actorType; return { ...row, changes, metadata: safeMetadata }; }), meta: { page: query.page, limit: query.limit, total, totalPages: total ? Math.ceil(total / query.limit) : 0 } };
}
