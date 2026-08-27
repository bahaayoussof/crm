import { z } from "zod";

const roleSchema = z.enum(["ADMIN", "MANAGER", "AGENT"]);
const emailSchema = z.string().trim().email("users.validation.email").transform((value) => value.toLowerCase());

export const userCreateFormSchema = z.object({
  name: z.string().trim().min(2, "users.validation.nameMin").max(100, "users.validation.nameMax"),
  email: emailSchema,
  password: z.string().min(8, "users.validation.passwordMin").max(128, "users.validation.passwordMax"),
  role: roleSchema,
});

// Role lives in the Edit User form (the only place a role changes). Self-edits
// keep the field read-only; the value is still submitted unchanged.
export const userEditFormSchema = z.object({
  name: z.string().trim().min(2, "users.validation.nameMin").max(100, "users.validation.nameMax"),
  email: emailSchema,
  role: roleSchema,
  isActive: z.boolean(),
});

export type UserCreateFormValues = z.input<typeof userCreateFormSchema>;
export type UserEditFormValues = z.input<typeof userEditFormSchema>;
