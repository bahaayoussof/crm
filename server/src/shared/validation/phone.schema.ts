import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return null;

  const phone = parsePhoneNumberFromString(trimmed);
  return phone?.isValid() ? phone.number : null;
}

export const requiredPhoneSchema = z
  .string()
  .trim()
  .max(50)
  .transform((value, context) => {
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "INVALID_PHONE" });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  requiredPhoneSchema.nullable().optional(),
);

export function formatPhoneForDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}
