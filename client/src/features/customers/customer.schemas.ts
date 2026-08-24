import { z } from "zod";

export const customerFormSchema = z.object({
  name: z.string().trim().min(2, "customers.validation.name").max(100),
  email: z.string().trim().email("customers.validation.email").transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30, "customers.validation.phone").optional(),
}).strict();

export const customerNoteSchema = z.object({
  body: z.string().trim().min(1, "customers.validation.note").max(5000),
}).strict();

export type CustomerFormValues = z.input<typeof customerFormSchema>;
export type CustomerNoteValues = z.input<typeof customerNoteSchema>;
