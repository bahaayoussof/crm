import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField, nullableDatabaseIdSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

const name = z.string().trim().min(2).max(100);
const description = z.string().trim().max(500);
// Absent key -> undefined (leave unchanged). Empty string / null -> null (clear).

export const departmentListQuerySchema = z
  .object({
    ...paginationFields(15),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const departmentParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createDepartmentSchema = z
  .object({ name, description: description.optional(), branchId: nullableDatabaseIdSchema })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    isActive: z.boolean().optional(),
    branchId: nullableDatabaseIdSchema,
  })
  .strict()
  .refine(hasAtLeastOneField, {
    message: "At least one department field is required",
  });

export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;
export type DepartmentParams = z.infer<typeof departmentParamsSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
