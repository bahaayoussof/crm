import { z } from "zod";

const dateValue = z.string().datetime({ offset: true }).transform((value) => new Date(value));
export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().min(1).max(200).optional(), actorId: z.string().trim().min(1).max(100).optional(),
  action: z.string().trim().min(1).max(100).optional(), entityType: z.string().trim().min(1).max(100).optional(), entityId: z.string().trim().min(1).max(100).optional(),
  from: dateValue.optional(), to: dateValue.optional(),
}).strict().superRefine((value, ctx) => { if (value.from && value.to && value.from > value.to) ctx.addIssue({ code: "custom", path: ["to"], message: "to must be on or after from" }); });
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
