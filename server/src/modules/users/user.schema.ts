import { Role } from "@prisma/client";
import { z } from "zod";
import { optionalPhoneSchema } from "../../shared/utils/phone.js";

// Internal users only — CUSTOMER identities are managed through registration and
// the Customer module, never this administrative surface.
export const manageableRoleSchema = z.nativeEnum(Role).refine((role) => role !== Role.CUSTOMER, {
  message: "Role must be ADMIN, MANAGER, or AGENT",
});

const normalizedEmail = z.string().trim().email().transform((value) => value.toLowerCase());

// Absent key -> undefined (leave unchanged). Empty string / null -> null (clear).
const orgId = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().trim().min(1).nullable().optional(),
);

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(""),
  role: manageableRoleSchema.optional(),
  status: z.enum(["active", "inactive"]).optional(),
}).strict();

export const userParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: normalizedEmail,
  password: z.string().min(8).max(128),
  role: manageableRoleSchema,
  departmentId: orgId,
  branchId: orgId,
}).strict();

// One safe update payload for the ADMIN-only user-management surface. Every field
// is optional (partial updates are allowed), unknown fields are rejected, and an
// active ADMIN may edit all of them: name, email, phone, role, branch,
// department, and activation. Phone reuses the shared `optionalPhoneSchema`
// (same normalization/validation as the profile endpoints) — no duplicate.
export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: normalizedEmail.optional(),
  phone: optionalPhoneSchema,
  role: manageableRoleSchema.optional(),
  isActive: z.boolean().optional(),
  departmentId: orgId,
  branchId: orgId,
}).strict().refine((value) => Object.keys(value).length > 0, { message: "At least one user field is required" });

export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
