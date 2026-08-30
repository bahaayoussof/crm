import { z } from "zod";

const emailSchema = z.string().trim().email("validation.email").transform((value) => value.toLowerCase());

/** Shared new-password rule, mirrors the server `passwordSchema`. */
export const passwordSchema = z.string().min(8, "validation.passwordMin").max(128);

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "validation.passwordRequired"),
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .strictObject({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "validation.passwordMatch",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, "validation.passwordRequired"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "validation.passwordMatch",
    path: ["confirmPassword"],
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    message: "validation.passwordSame",
    path: ["newPassword"],
  });

export const registrationSchema = z
  .strictObject({
    name: z.string().trim().min(2, "validation.nameMin").max(100),
    email: emailSchema,
    phone: z.string().trim().max(30, "validation.phoneMax").optional(),
    password: z.string().min(8, "validation.passwordMin").max(128),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "validation.passwordMatch",
    path: ["confirmPassword"],
  });

export type LoginValues = z.input<typeof loginSchema>;
export type RegistrationValues = z.input<typeof registrationSchema>;
export type ForgotPasswordValues = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.input<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.input<typeof changePasswordSchema>;

