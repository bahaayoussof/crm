import { z } from "zod";

export const quickReplyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().max(100).default(""),
}).strict();

export const quickReplyParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(5_000),
}).strict();

export const updateQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(1).max(5_000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one quick reply field is required" });

export type QuickReplyListQuery = z.infer<typeof quickReplyListQuerySchema>;
export type QuickReplyParams = z.infer<typeof quickReplyParamsSchema>;
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;
