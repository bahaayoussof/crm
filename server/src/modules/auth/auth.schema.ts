import { z } from "zod";

const normalizedEmail = z.string().trim().email().transform((value) => value.toLowerCase());

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: normalizedEmail,
    password: z.string().min(8).max(128),
    phone: z.string().trim().min(5).max(30).optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: normalizedEmail,
    password: z.string().min(1).max(128),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
