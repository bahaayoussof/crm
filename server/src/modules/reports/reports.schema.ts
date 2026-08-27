import { z } from "zod";

const DAY_MS = 86_400_000;
export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

/**
 * Reports date-range query. `from`/`to` are optional ISO datetimes; the range
 * defaults to the last 30 days ending now. All bucketing downstream is UTC.
 */
export const reportsRangeQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
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

    return { start, end };
  });

export type ReportsRange = z.infer<typeof reportsRangeQuerySchema>;
