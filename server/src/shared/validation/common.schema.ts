import { z } from "zod";

export const databaseIdSchema = z.cuid();

export const nullableDatabaseIdSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  databaseIdSchema.nullable().optional(),
);

export const emailSchema = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((value) => value.toLowerCase());

export const passwordSchema = z.string().min(8).max(128);

export const hasAtLeastOneField = (value: object): boolean => Object.keys(value).length > 0;
