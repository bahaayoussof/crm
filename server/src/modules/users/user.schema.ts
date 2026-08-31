import { Role } from "@prisma/client";
import { z } from "zod";
import { databaseIdSchema, emailSchema, hasAtLeastOneField, nullableDatabaseIdSchema, passwordSchema } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";
import { optionalPhoneSchema } from "../../shared/validation/phone.schema.js";

// Internal users only — CUSTOMER identities are managed through registration and
// the Customer module, never this administrative surface.
export const manageableRoleSchema = z.nativeEnum(Role).refine((role) => role !== Role.CUSTOMER, {
  message: "Role must be ADMIN, MANAGER, or AGENT",
});

export const userListQuerySchema = z.object({
  ...paginationFields(),
  search: z.string().trim().max(100).default(""),
  role: manageableRoleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict();

export const userParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  password: passwordSchema,
  role: manageableRoleSchema,
  departmentId: nullableDatabaseIdSchema,
  branchId: nullableDatabaseIdSchema,
}).strict();

// One safe update payload for the ADMIN-only user-management surface. Every field
// is optional (partial updates are allowed), unknown fields are rejected, and an
// active ADMIN may edit all of them: name, email, phone, role, branch,
// department, and activation. Phone reuses the shared `optionalPhoneSchema`
// (same normalization/validation as the profile endpoints) — no duplicate.
export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: emailSchema.optional(),
  phone: optionalPhoneSchema,
  role: manageableRoleSchema.optional(),
  isActive: z.boolean().optional(),
  departmentId: nullableDatabaseIdSchema,
  branchId: nullableDatabaseIdSchema,
}).strict().refine(hasAtLeastOneField, { message: "At least one user field is required" });

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
