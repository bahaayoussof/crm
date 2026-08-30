import { z } from "zod";
import { optionalPhoneSchema } from "../../shared/utils/phone.js";

export const normalizedEmail = z.string().trim().max(254).email().transform((value) => value.toLowerCase());

/** Single source of truth for password strength on the server. */
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: normalizedEmail,
    password: passwordSchema,
    phone: optionalPhoneSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: normalizedEmail,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: normalizedEmail,
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
    email: normalizedEmail.optional(),
    phone: optionalPhoneSchema,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type SelfProfileUpdateInput = z.infer<typeof selfProfileUpdateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
