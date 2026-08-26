import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateQuickReplyInput, QuickReplyListQuery, UpdateQuickReplyInput } from "./quick-reply.schema.js";

const authorSelect = { select: { id: true, name: true, role: true } } satisfies Prisma.UserDefaultArgs;

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

export async function createQuickReply(input: CreateQuickReplyInput, actor: { userId: string }) {
  return prisma.quickReply.create({
    data: { title: input.title, body: input.body, createdById: actor.userId },
    select: quickReplySelect,
  });
}

export async function updateQuickReply(id: string, input: UpdateQuickReplyInput) {
  const existing = await prisma.quickReply.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound();

  const data: Prisma.QuickReplyUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.body !== undefined) data.body = input.body;

  return prisma.quickReply.update({ where: { id }, data, select: quickReplySelect });
}

export async function deleteQuickReply(id: string) {
  const existing = await prisma.quickReply.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound();
  await prisma.quickReply.delete({ where: { id } });
}
