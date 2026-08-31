import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

const dateValue = z.string().datetime({ offset: true }).transform((value) => new Date(value));
export const auditLogQuerySchema = z.object({
  ...paginationFields(15),
  search: z.string().trim().min(1).max(200).optional(), actorId: databaseIdSchema.optional(),
  action: z.string().trim().min(1).max(100).optional(), entityType: z.string().trim().min(1).max(100).optional(), entityId: databaseIdSchema.optional(),
  from: dateValue.optional(), to: dateValue.optional(),
}).strict().superRefine((value, ctx) => { if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" }); });
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
