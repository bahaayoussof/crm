import {
  defaultCountries,
  getActiveFormattingMask,
  guessCountryByPartialPhoneNumber,
} from "react-international-phone";
import { z } from "zod";

/**
 * Validates whether the given phone number is valid and complete for its country
 * using metadata from react-international-phone.
 */
export function isPhoneValid(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("+")) return false;

  const guessed = guessCountryByPartialPhoneNumber({
    phone: trimmed,
    countries: defaultCountries,
  });

  if (!guessed || !guessed.fullDialCodeMatch || !guessed.country) return false;

  const country = guessed.country;
  const digitsOnly = trimmed.replace(/\D/g, "");
  const dialCodeDigits = country.dialCode.replace(/\D/g, "");
  const nationalDigits = digitsOnly.slice(dialCodeDigits.length);

  if (!nationalDigits || nationalDigits.length === 0) return false;

  if (country.format) {
    const mask = getActiveFormattingMask({ country, phone: trimmed });
    const maskDots = (mask.match(/\./g) || []).length;
    if (maskDots > 0) {
      return nationalDigits.length === maskDots;
    }
  }

  return nationalDigits.length >= 4 && nationalDigits.length <= 13;
}

/**
 * Validates and normalizes an international phone number to canonical E.164 (+<digits>) format
 * using country metadata from react-international-phone.
 * Returns null if invalid, incomplete, or malformed.
 */
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!isPhoneValid(trimmed)) return null;
  const digitsOnly = trimmed.replace(/\D/g, "");
  return `+${digitsOnly}`;
}

/**
 * Validates that the input is either empty (optional) or a valid international phone number.
 * Transforms valid non-empty inputs into canonical E.164 format.
 */
export const optionalPhoneInputSchema = z
  .string()
  .trim()
  .max(50, "validation.phoneTooLong")
  .transform((value, context) => {
    if (!value) return "";
    const normalized = normalizePhoneNumber(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "validation.phoneInvalid" });
      return z.NEVER;
    }
    return normalized;
  });

function formatWithMask(phone: string, mask: string, dialCode: string): string {
  const digits = phone.replace(/\D/g, "").slice(dialCode.length);
  if (!digits) return `+${dialCode}`;
  if (!mask) return `+${dialCode} ${digits}`;

  let digitIdx = 0;
  let res = `+${dialCode} `;
  for (let i = 0; i < mask.length; i++) {
    if (digitIdx >= digits.length) break;
    if (mask[i] === ".") {
      res += digits[digitIdx++];
    } else {
      res += mask[i];
    }
  }
  if (digitIdx < digits.length) {
    res += digits.slice(digitIdx);
  }
  return res;
}

/**
 * Formats a canonical or legacy phone number for international display.
 */
export function formatPhoneForDisplay(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return trimmed;

  const guessed = guessCountryByPartialPhoneNumber({
    phone: trimmed,
    countries: defaultCountries,
  });

  if (!guessed || !guessed.fullDialCodeMatch || !guessed.country) return trimmed;

  const mask = getActiveFormattingMask({ country: guessed.country, phone: trimmed });
  return formatWithMask(trimmed, mask, guessed.country.dialCode);
}
