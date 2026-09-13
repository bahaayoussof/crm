import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

export const quickReplyListQuerySchema = z.object({
  ...paginationFields(15),
  search: z.string().trim().max(100).default(""),
}).strict();

export const quickReplyParamsSchema = z.object({ id: databaseIdSchema }).strict();

// `body` is now server-sanitized rich HTML (Quick Reply Rich Input). The
// transport bound is raised to give markup headroom over the 5,000-char
// readable-body ceiling; the real ceiling (non-empty, <= 5,000 readable chars
// after sanitize) is enforced in the service against the derived plain text —
// mirrors the Knowledge Base article body pattern (`RICH_CONTENT_MAX`).
const RICH_BODY_MAX = 20_000;

export const createQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(RICH_BODY_MAX),
}).strict();

export const updateQuickReplySchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  body: z.string().trim().min(1).max(RICH_BODY_MAX).optional(),
}).strict().refine(hasAtLeastOneField, { message: "At least one quick reply field is required" });

export type QuickReplyListQuery = z.infer<typeof quickReplyListQuerySchema>;
export type QuickReplyParams = z.infer<typeof quickReplyParamsSchema>;
export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;
