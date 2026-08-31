import { TicketPriority } from "@prisma/client";
import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";

const description = z.string().trim().max(500);
export const settingsCategoryQuerySchema = z.object({ search: z.string().trim().max(100).default("") }).strict();
export const settingsIdSchema = z.object({ id: databaseIdSchema }).strict();
export const createSettingsCategorySchema = z.object({ name: z.string().trim().min(2).max(100), description: description.optional() }).strict();
export const updateSettingsCategorySchema = z.object({ name: z.string().trim().min(2).max(100).optional(), description: description.optional(), isActive: z.boolean().optional() }).strict().refine(hasAtLeastOneField, "At least one field is required");
export const slaPrioritySchema = z.object({ priority: z.nativeEnum(TicketPriority) }).strict();
export const upsertSlaRuleSchema = z.object({
  firstResponseMinutes: z.number().int().min(1).max(525_600),
  resolutionMinutes: z.number().int().min(1).max(525_600),
  isActive: z.boolean(),
}).strict().refine((v) => v.resolutionMinutes >= v.firstResponseMinutes, { path: ["resolutionMinutes"], message: "Resolution target cannot be lower than first response target" });

export type CategoryQuery = z.infer<typeof settingsCategoryQuerySchema>;
export type CreateCategory = z.infer<typeof createSettingsCategorySchema>;
export type UpdateCategory = z.infer<typeof updateSettingsCategorySchema>;
export type UpsertSla = z.infer<typeof upsertSlaRuleSchema>;
