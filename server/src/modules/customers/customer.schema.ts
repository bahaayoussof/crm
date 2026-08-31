import { z } from "zod";
import { databaseIdSchema, emailSchema, hasAtLeastOneField } from "../../shared/validation/common.schema.js";
import { paginationFields } from "../../shared/validation/pagination.schema.js";
import { optionalPhoneSchema } from "../../shared/validation/phone.schema.js";

export const customerListQuerySchema = z.object({
  search: z.string().trim().max(100).default(""),
  ...paginationFields(),
}).strict();

export const customerParamsSchema = z.object({ id: databaseIdSchema }).strict();

export const customerTicketListQuerySchema = z.object({
  ...paginationFields(),
}).strict();

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  phone: optionalPhoneSchema,
}).strict();

export const updateCustomerSchema = createCustomerSchema.partial().refine(
  hasAtLeastOneField,
  { message: "At least one customer field is required" },
);

export const createCustomerNoteSchema = z.object({
  body: z.string().trim().min(1).max(5000),
}).strict();

export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CustomerParams = z.infer<typeof customerParamsSchema>;
export type CustomerTicketListQuery = z.infer<typeof customerTicketListQuerySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
