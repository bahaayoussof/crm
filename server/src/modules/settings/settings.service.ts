import { Prisma, TicketPriority } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CategoryQuery, CreateCategory, UpdateCategory, UpsertSla } from "./settings.schema.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";

const categorySelect = { id: true, name: true, description: true, isActive: true, createdAt: true, updatedAt: true } satisfies Prisma.CategorySelect;
const slaSelect = { id: true, priority: true, firstResponseMinutes: true, resolutionMinutes: true, isActive: true, createdAt: true, updatedAt: true } satisfies Prisma.SlaRuleSelect;
const priorities = [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT];

const categoryConflict = () => new AppError(409, "CATEGORY_NAME_ALREADY_EXISTS", "A category with this name already exists");
function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw categoryConflict();
  throw error;
}

export async function listCategories(query: CategoryQuery) {
  return prisma.category.findMany({ where: query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}, orderBy: [{ name: "asc" }, { id: "asc" }], select: categorySelect });
}
export async function createCategory(input: CreateCategory, actorId: string, requestContext?: AuditRequestContext) {
  try { return await prisma.$transaction(async (tx) => { const row = await tx.category.create({ data: { name: input.name, description: input.description || null }, select: categorySelect }); await createAuditLog({ actorId, action: AUDIT_ACTIONS.CATEGORY_CREATED, entityType: AUDIT_ENTITY_TYPES.CATEGORY, entityId: row.id, changes: { name: { to: row.name }, description: { to: row.description }, isActive: { to: row.isActive } }, requestContext }, tx); return row; }); } catch (error) { translateUnique(error); }
}
export async function updateCategory(id: string, input: UpdateCategory, actorId: string, requestContext?: AuditRequestContext) {
  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true, description: true, isActive: true } });
  if (!exists) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  try { return await prisma.$transaction(async (tx) => { const row = await tx.category.update({ where: { id }, data: { ...input, ...(input.description !== undefined && { description: input.description || null }) }, select: categorySelect }); const changes = changedFields(exists, row, ["name", "description", "isActive"]); if (Object.keys(changes).length) await createAuditLog({ actorId, action: AUDIT_ACTIONS.CATEGORY_UPDATED, entityType: AUDIT_ENTITY_TYPES.CATEGORY, entityId: id, changes, requestContext }, tx); return row; }); } catch (error) { translateUnique(error); }
}
export async function listSlaRules() {
  const rows = await prisma.slaRule.findMany({ select: slaSelect });
  return rows.sort((a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority));
}
export async function upsertSlaRule(priority: TicketPriority, input: UpsertSla, actorId: string, requestContext?: AuditRequestContext) {
  return prisma.$transaction(async (tx) => { const before = await tx.slaRule.findUnique({ where: { priority }, select: slaSelect }); const row = await tx.slaRule.upsert({ where: { priority }, create: { priority, ...input }, update: input, select: slaSelect }); const changes = before ? changedFields(before, row, ["firstResponseMinutes", "resolutionMinutes", "isActive"]) : { priority: { to: priority }, firstResponseMinutes: { to: row.firstResponseMinutes }, resolutionMinutes: { to: row.resolutionMinutes }, isActive: { to: row.isActive } }; if (!before || Object.keys(changes).length) await createAuditLog({ actorId, action: before ? AUDIT_ACTIONS.SLA_RULE_UPDATED : AUDIT_ACTIONS.SLA_RULE_CREATED, entityType: AUDIT_ENTITY_TYPES.SLA_RULE, entityId: row.id, changes, requestContext }, tx); return row; });
}
