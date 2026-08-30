import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, normalizePhoneNumber, optionalPhoneSchema } from "./phone.js";

describe("phone utilities", () => {
  it.each([
    ["+201001234567", "+201001234567"],
    ["+20 100 123 4567", "+201001234567"],
    ["+1 415 555 2671", "+14155552671"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalizes %s to E.164", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
    expect(optionalPhoneSchema.parse(input)).toBe(expected);
  });

  it.each(["abc123", "phone123", "++++123", "12", "01001234567", "1234567890123456789012345"])(
    "rejects %s",
    (input) => expect(optionalPhoneSchema.safeParse(input).success).toBe(false),
  );

  it("preserves optional PATCH semantics", () => {
    expect(optionalPhoneSchema.parse("")).toBeNull();
    expect(optionalPhoneSchema.parse("   ")).toBeNull();
    expect(optionalPhoneSchema.parse(null)).toBeNull();
    expect(optionalPhoneSchema.parse(undefined)).toBeUndefined();
  });

  it("formats E.164 and safely falls back for legacy values", () => {
    expect(formatPhoneForDisplay("+442079460958")).toBe("+44 20 7946 0958");
    expect(formatPhoneForDisplay("legacy-phone")).toBe("legacy-phone");
  });
});
