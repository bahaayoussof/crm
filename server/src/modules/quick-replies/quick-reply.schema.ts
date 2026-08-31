import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

export const quickReplyListQuerySchema = z.object({
  ...paginationFields(15),
  search: z.string().trim().max(100).default(""),
}).strict();

export const quickReplyParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(5_000),
}).strict();

export const updateQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(1).max(5_000).optional(),
}).strict().refine(hasAtLeastOneField, { message: "At least one quick reply field is required" });

export type QuickReplyListQuery = z.infer<typeof quickReplyListQuerySchema>;
export type QuickReplyParams = z.infer<typeof quickReplyParamsSchema>;
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;
