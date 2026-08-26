import { KnowledgeArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
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

export function deriveExcerpt(content: string, max = EXCERPT_MAX) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trimEnd()}…`;
}

function searchWhere(search: string): Prisma.KnowledgeArticleWhereInput {
  return { OR: [
    { title: { contains: search, mode: "insensitive" } },
    { content: { contains: search, mode: "insensitive" } },
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

export async function createKnowledgeArticle(input: CreateKnowledgeArticleInput, actor: { userId: string }) {
  return prisma.knowledgeArticle.create({
    data: {
      title: input.title,
      content: input.content,
      category: input.category ?? null,
      status: input.status,
      createdById: actor.userId,
    },
    select: detailSelect,
  });
}

export async function updateKnowledgeArticle(id: string, input: UpdateKnowledgeArticleInput) {
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound();

  const data: Prisma.KnowledgeArticleUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.content !== undefined) data.content = input.content;
  if (input.category !== undefined) data.category = input.category;
  if (input.status !== undefined) data.status = input.status;

  return prisma.knowledgeArticle.update({ where: { id }, data, select: detailSelect });
}

export async function deleteKnowledgeArticle(id: string) {
  const existing = await prisma.knowledgeArticle.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound();
  await prisma.knowledgeArticle.delete({ where: { id } });
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
      select: { id: true, title: true, category: true, content: true, updatedAt: true },
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);
  return {
    data: records.map(({ content, ...rest }) => ({ ...rest, excerpt: deriveExcerpt(content) })),
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
