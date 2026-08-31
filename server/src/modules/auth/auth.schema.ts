import { z } from "zod";
import { emailSchema, hasAtLeastOneField, passwordSchema } from "../../shared/validation/common.schema.js";
import { optionalPhoneSchema } from "../../shared/validation/phone.schema.js";

export { emailSchema as normalizedEmail, passwordSchema } from "../../shared/validation/common.schema.js";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    phone: optionalPhoneSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(512),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .strict()
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

/**
 * Self-service profile edit for any authenticated role. Explicit whitelist —
 * name / email / phone only. Role-aware field permissions are enforced on the server.
 * `.strict()` rejects role / language / timeZone / etc. with a 400 rather than silently dropping them.
 */
export const selfProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    email: emailSchema.optional(),
    phone: optionalPhoneSchema,
  })
  .strict()
  .refine(hasAtLeastOneField, {
    message: "At least one field must be provided",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type SelfProfileUpdateInput = z.infer<typeof selfProfileUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
