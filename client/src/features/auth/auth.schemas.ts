import { z } from "zod";

const emailSchema = z.string().trim().email("Enter a valid email address").transform((value) => value.toLowerCase());

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registrationSchema = z
  .strictObject({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: emailSchema,
    phone: z.string().trim().max(30).optional(),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginValues = z.input<typeof loginSchema>;
export type RegistrationValues = z.input<typeof registrationSchema>;

