import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";

const DAY_MS = 86_400_000;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

export const AGENT_SORT_FIELDS = [
  "name",
  "assigned",
  "resolved",
  "open",
  "slaMetPercentage",
  "avgFirstResponse",
] as const;

export type AgentSortField = (typeof AGENT_SORT_FIELDS)[number];

/**
 * Reports date-range query. `from`/`to` are optional ISO datetimes; the range
 * defaults to the last 30 days ending now. All bucketing downstream is UTC.
 */
export const reportsRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    departmentId: databaseIdSchema.optional(),
    branchId: databaseIdSchema.optional(),
  })
  .strict()
  .transform((value, ctx) => {
    const end = value.to ?? new Date();
    const start = value.from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return z.NEVER;
    }
    if (start.getTime() > end.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "`from` must be on or before `to`" });
      return z.NEVER;
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Range must not exceed ${MAX_RANGE_DAYS} days` });
      return z.NEVER;
    }

    return { start, end, departmentId: value.departmentId, branchId: value.branchId, teamId: undefined as string | null | undefined };
  });

export type ReportsRange = z.infer<typeof reportsRangeQuerySchema>;

export const reportsAgentsQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    departmentId: databaseIdSchema.optional(),
    branchId: databaseIdSchema.optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(15),
    sortBy: z.enum(AGENT_SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .transform((value, ctx) => {
    const end = value.to ?? new Date();
    const start = value.from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date range" });
      return z.NEVER;
    }
    if (start.getTime() > end.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "`from` must be on or before `to`" });
      return z.NEVER;
    }
    if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Range must not exceed ${MAX_RANGE_DAYS} days` });
      return z.NEVER;
    }

    return {
      start,
      end,
      departmentId: value.departmentId,
      branchId: value.branchId,
      teamId: undefined as string | null | undefined,
      search: value.search?.length ? value.search : undefined,
      page: value.page,
      limit: value.limit,
      sortBy: value.sortBy,
      sortOrder: value.sortOrder,
    };
  });

export type ReportsAgentsQuery = z.infer<typeof reportsAgentsQuerySchema>;

