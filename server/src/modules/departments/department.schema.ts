import { z } from "zod";

const name = z.string().trim().min(2).max(100);
const description = z.string().trim().max(500);
// Absent key -> undefined (leave unchanged). Empty string / null -> null (clear).
const branchId = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().min(1).nullable().optional(),
);

export const departmentListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(15),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const departmentParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createDepartmentSchema = z
  .object({ name, description: description.optional(), branchId })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    isActive: z.boolean().optional(),
    branchId,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one department field is required",
  });

export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;
export type DepartmentParams = z.infer<typeof departmentParamsSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
