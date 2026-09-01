import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

/**
 * Team-workload table query. Live active-load counts are computed server-side;
 * search/sort/pagination happen in memory (the agent roster is small).
 */
export const TEAM_SORT_FIELDS = [
  "name",
  "openAssigned",
  "inProgress",
  "waitingCustomer",
  "resolved",
  "slaCompliance",
  "avgFirstResponse",
  "avgResolution",
] as const;

export type TeamSortField = (typeof TEAM_SORT_FIELDS)[number];

export const managerTeamQuerySchema = z
  .object({
    ...paginationFields(15),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(TEAM_SORT_FIELDS).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .transform((value) => ({
    ...value,
    search: value.search?.length ? value.search : undefined,
  }));

export type ManagerTeamQuery = z.infer<typeof managerTeamQuerySchema>;

export const managerAgentParamsSchema = z.object({ agentId: databaseIdSchema }).strict();

export type ManagerAgentParams = z.infer<typeof managerAgentParamsSchema>;
