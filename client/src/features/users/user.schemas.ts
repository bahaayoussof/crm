import { z } from "zod";
import { optionalPhoneInputSchema } from "@/lib/phone";
import type { User } from "./user.types";

const roleSchema = z.enum(["ADMIN", "MANAGER", "AGENT"]);
const emailSchema = z.string().trim().email("users.validation.email").transform((value) => value.toLowerCase());

// Organizational assignment fields. "" / undefined means "unassigned" (sent as null).
const orgId = z.string().trim().optional();

export const userCreateFormSchema = z.object({
  name: z.string().trim().min(2, "users.validation.nameMin").max(100, "users.validation.nameMax"),
  email: emailSchema,
  password: z.string().min(8, "users.validation.passwordMin").max(128, "users.validation.passwordMax"),
  role: roleSchema,
  departmentId: orgId,
  branchId: orgId,
});

// ADMIN-only user-management edit. An active ADMIN may edit every supported
// field of another internal user. Self-management guards (role/status) are
// applied in the form, and the server is the authority (`SELF_ROLE_CHANGE_FORBIDDEN`,
// `SELF_DEACTIVATION_FORBIDDEN`, `LAST_ACTIVE_ADMIN_REQUIRED`).
export const userEditFormSchema = z.object({
  name: z.string().trim().min(2, "users.validation.nameMin").max(100, "users.validation.nameMax"),
  email: emailSchema,
  role: roleSchema,
  phone: optionalPhoneInputSchema,
  isActive: z.boolean().optional(),
  departmentId: orgId,
  branchId: orgId,
});

export type UserCreateFormValues = z.input<typeof userCreateFormSchema>;
export type UserEditFormValues = z.input<typeof userEditFormSchema>;

/**
 * Canonical loaded-user → edit-form mapping. Every Edit User flow (full page,
 * row-action modal) MUST seed React Hook Form through this so the two surfaces
 * cannot diverge. Covers the complete editable form state — notably `role`,
 * which stays the raw API enum value ("MANAGER"), never the display label.
 */
export function mapUserToEditFormValues(user: User): UserEditFormValues {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? "",
    isActive: user.isActive,
    departmentId: user.departmentId ?? "",
    branchId: user.branchId ?? "",
  };
}
