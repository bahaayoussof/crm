import { z } from "zod";
import { databaseIdSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";

const name = z.string().trim().min(2).max(100);
// Absent -> undefined (unchanged). Empty string / null -> null (clear).
const code = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().min(1).max(40).nullable().optional(),
);
const address = z.string().trim().max(300);

export const branchListQuerySchema = z
  .object({
    ...paginationFields(15),
    search: z.string().trim().max(100).default(""),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export const branchParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createBranchSchema = z
  .object({ name, code: code.optional(), address: address.optional() })
  .strict();

export const updateBranchSchema = z
  .object({
    name: name.optional(),
    code: code.optional(),
    address: address.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField, {
    message: "At least one branch field is required",
  });

export type BranchListQuery = z.infer<typeof branchListQuerySchema>;
export type BranchParams = z.infer<typeof branchParamsSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
