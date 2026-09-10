import { KnowledgeArticleStatus } from "@prisma/client";
import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

const optionalCategory = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().min(1).max(100).nullable().optional(),
);

export const knowledgeArticleListQuerySchema = z.object({
  ...paginationFields(),
  search: z.string().trim().max(100).default(""),
  status: z.nativeEnum(KnowledgeArticleStatus).optional(),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();

export const knowledgeArticleParamsSchema = z.object({ id: databaseIdSchema }).strict();

// `content` is now server-sanitized rich HTML (KB-RICH). The transport bound is
// raised to give markup headroom over a ~50 000-char readable body; the real
// ceiling (non-empty, <= 50 000 readable chars after sanitize) is enforced in
// the service against the derived plain text.
const RICH_CONTENT_MAX = 200_000;

export const createKnowledgeArticleSchema = z.object({
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(1).max(RICH_CONTENT_MAX),
  category: optionalCategory,
  status: z.nativeEnum(KnowledgeArticleStatus).default(KnowledgeArticleStatus.DRAFT),
}).strict();

export const updateKnowledgeArticleSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  content: z.string().trim().min(1).max(RICH_CONTENT_MAX).optional(),
  category: optionalCategory,
  status: z.nativeEnum(KnowledgeArticleStatus).optional(),
}).strict().refine(hasAtLeastOneField, { message: "At least one knowledge article field is required" });

export const portalKnowledgeArticleListQuerySchema = z.object({
  ...paginationFields(),
  search: z.string().trim().max(100).default(""),
  category: z.string().trim().min(1).max(100).optional(),
}).strict();

export type KnowledgeArticleListQuery = z.infer<typeof knowledgeArticleListQuerySchema>;
export type KnowledgeArticleParams = z.infer<typeof knowledgeArticleParamsSchema>;
export type CreateKnowledgeArticleInput = z.infer<typeof createKnowledgeArticleSchema>;
export type UpdateKnowledgeArticleInput = z.infer<typeof updateKnowledgeArticleSchema>;
export type PortalKnowledgeArticleListQuery = z.infer<typeof portalKnowledgeArticleListQuerySchema>;
