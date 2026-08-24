import { z } from "zod";

const emailSchema = z.string().trim().email("validation.email").transform((value) => value.toLowerCase());

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "validation.passwordRequired"),
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

