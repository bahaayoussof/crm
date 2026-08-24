import { z } from "zod";

const normalizedEmail = z.string().trim().email().transform((value) => value.toLowerCase());
const optionalPhone = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().min(5).max(30).nullable().optional(),
);

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const customerParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: normalizedEmail,
  phone: optionalPhone,
}).strict();

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one customer field is required" },
);

export const createCustomerNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
}).strict();

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CustomerParams = z.infer<typeof customerParamsSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
