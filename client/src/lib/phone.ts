import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

export function normalizePhoneNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith("+")) return null;

  const phone = parsePhoneNumberFromString(trimmed);
  return phone?.isPossible() ? phone.number : null;
}

export const optionalPhoneInputSchema = z.string().trim().max(50, "validation.phoneTooLong").transform((value, context) => {
  if (!value) return "";
  const normalized = normalizePhoneNumber(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: "validation.phoneInvalid" });
    return z.NEVER;
  }
  return normalized;
});

export function formatPhoneForDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value;
}
