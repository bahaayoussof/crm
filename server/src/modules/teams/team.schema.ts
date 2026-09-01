import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField, nullableDatabaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

const name = z.string().trim().min(2).max(100);

export const teamListQuerySchema = z
  .object({
    ...paginationFields(15),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["active", "inactive"]).optional(),
    departmentId: databaseIdSchema.optional(),
  })
  .strict();

export const teamParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createTeamSchema = z
  .object({
    name,
    departmentId: databaseIdSchema,
    // Optional at creation: a team can exist before a manager is assigned.
    managerId: nullableDatabaseIdSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateTeamSchema = z
  .object({
    name: name.optional(),
    departmentId: databaseIdSchema.optional(),
    managerId: nullableDatabaseIdSchema,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField, { message: "At least one team field is required" });

export type TeamListQuery = z.infer<typeof teamListQuerySchema>;
export type TeamParams = z.infer<typeof teamParamsSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
