import { describe, expect, it } from "vitest";
import {
  formatPhoneForDisplay,
  isPhoneValid,
  normalizePhoneNumber,
  optionalPhoneInputSchema,
} from "./phone";

describe("phone utilities", () => {
  describe("isPhoneValid", () => {
    it.each([
      ["+201001234567", true],
      ["+20 100 123 4567", true],
      ["+14155552671", true],
      ["+1 415 555 2671", true],
      ["+442079460958", true],
      ["+966512345678", true],
      ["+971501234567", true],
    ])("accepts valid phone %s", (input, expected) => {
      expect(isPhoneValid(input)).toBe(expected);
    });

    it.each([
      "+20",
      "+2010",
      "+1",
      "+1415555267", // incomplete US
      "+141555526719", // too long US
      "+96651234567", // incomplete Saudi
      "",
      "   ",
      "abc123",
      "01001234567",
      "+999999999999",
    ])("rejects invalid/incomplete phone %s", (input) => {
      expect(isPhoneValid(input)).toBe(false);
    });
  });

  describe("normalizePhoneNumber", () => {
    it.each([
      ["+201001234567", "+201001234567"],
      ["+20 100 123 4567", "+201001234567"],
      ["+1 415 555 2671", "+14155552671"],
      ["+44 20 7946 0958", "+442079460958"],
      ["+966 51 234 5678", "+966512345678"],
    ])("normalizes %s to E.164", (input, expected) => {
      expect(normalizePhoneNumber(input)).toBe(expected);
    });

    it.each(["abc123", "phone123", "++++123", "12", "01001234567", "+20", "+1415"])(
      "returns null for invalid/incomplete %s",
      (input) => expect(normalizePhoneNumber(input)).toBeNull(),
    );
  });

  describe("optionalPhoneInputSchema", () => {
    it("accepts empty and whitespace inputs", () => {
      expect(optionalPhoneInputSchema.parse("")).toBe("");
      expect(optionalPhoneInputSchema.parse("   ")).toBe("");
    });

    it("parses and normalizes valid numbers", () => {
      expect(optionalPhoneInputSchema.parse("+20 100 123 4567")).toBe("+201001234567");
      expect(optionalPhoneInputSchema.parse("+1 415 555 2671")).toBe("+14155552671");
    });

    it("rejects invalid numbers with validation.phoneInvalid", () => {
      const result = optionalPhoneInputSchema.safeParse("+12345");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("validation.phoneInvalid");
      }
    });
  });

  describe("formatPhoneForDisplay", () => {
    it("formats persisted E.164 and safely falls back for legacy values", () => {
      expect(formatPhoneForDisplay("+442079460958")).toBe("+44 2079 460958");
      expect(formatPhoneForDisplay("legacy-phone")).toBe("legacy-phone");
    });
  });
});
