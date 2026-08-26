import { KnowledgeArticleStatus } from "@prisma/client";
import { z } from "zod";

const optionalCategory = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).max(100).nullable().optional(),
);

export const knowledgeArticleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(""),
  status: z.nativeEnum(KnowledgeArticleStatus).optional(),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();

export const knowledgeArticleParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createKnowledgeArticleSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(50_000),
  category: optionalCategory,
  status: z.nativeEnum(KnowledgeArticleStatus).default(KnowledgeArticleStatus.DRAFT),
}).strict();

export const updateKnowledgeArticleSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  content: z.string().trim().min(1).max(50_000).optional(),
  category: optionalCategory,
  status: z.nativeEnum(KnowledgeArticleStatus).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one knowledge article field is required" });

export const portalKnowledgeArticleListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(""),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();

export type KnowledgeArticleListQuery = z.infer<typeof knowledgeArticleListQuerySchema>;
export type KnowledgeArticleParams = z.infer<typeof knowledgeArticleParamsSchema>;
export type CreateKnowledgeArticleInput = z.infer<typeof createKnowledgeArticleSchema>;
export type UpdateKnowledgeArticleInput = z.infer<typeof updateKnowledgeArticleSchema>;
export type PortalKnowledgeArticleListQuery = z.infer<typeof portalKnowledgeArticleListQuerySchema>;
