import { Prisma, TicketPriority } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CategoryQuery, CreateCategory, UpdateCategory, UpsertSla } from "./settings.schema.js";

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
export async function createCategory(input: CreateCategory) {
  try { return await prisma.category.create({ data: { name: input.name, description: input.description || null }, select: categorySelect }); } catch (error) { translateUnique(error); }
}
export async function updateCategory(id: string, input: UpdateCategory) {
  const exists = await prisma.category.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  try { return await prisma.category.update({ where: { id }, data: { ...input, ...(input.description !== undefined && { description: input.description || null }) }, select: categorySelect }); } catch (error) { translateUnique(error); }
}
export async function listSlaRules() {
  const rows = await prisma.slaRule.findMany({ select: slaSelect });
  return rows.sort((a, b) => priorities.indexOf(a.priority) - priorities.indexOf(b.priority));
}
export async function upsertSlaRule(priority: TicketPriority, input: UpsertSla) {
  return prisma.slaRule.upsert({ where: { priority }, create: { priority, ...input }, update: input, select: slaSelect });
}
