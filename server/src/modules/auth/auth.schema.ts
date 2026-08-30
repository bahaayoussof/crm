import { z } from "zod";

export const normalizedEmail = z.string().trim().email().transform((value) => value.toLowerCase());

/** Single source of truth for password strength on the server. */
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: normalizedEmail,
    password: passwordSchema,
    phone: z.string().trim().min(5).max(30).optional(),
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
    confirmPassword: z.string(),
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
    confirmPassword: z.string(),
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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
