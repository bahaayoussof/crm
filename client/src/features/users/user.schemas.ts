import { z } from "zod";
import { optionalPhoneInputSchema } from "@/lib/phone";

const roleSchema = z.enum(["ADMIN", "MANAGER", "AGENT"]);
const emailSchema = z.string().trim().email("users.validation.email").transform((value) => value.toLowerCase());

export const userCreateFormSchema = z.object({
  name: z.string().trim().min(2, "users.validation.nameMin").max(100, "users.validation.nameMax"),
  email: emailSchema,
  password: z.string().min(8, "users.validation.passwordMin").max(128, "users.validation.passwordMax"),
  role: roleSchema,
});

export const userEditFormSchema = z.object({
  phone: optionalPhoneInputSchema,
  isActive: z.boolean().optional(),
});

export type UserCreateFormValues = z.input<typeof userCreateFormSchema>;
export type UserEditFormValues = z.input<typeof userEditFormSchema>;
