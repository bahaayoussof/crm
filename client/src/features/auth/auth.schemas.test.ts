import { describe, expect, it } from "vitest";
import { loginSchema, registrationSchema } from "./auth.schemas";

describe("authentication form schemas", () => {
  it("normalizes login email and requires a password", () => {
    expect(loginSchema.parse({ email: " USER@Example.com ", password: "password123" }).email).toBe("user@example.com");
    expect(loginSchema.safeParse({ email: "user@example.com", password: "" }).success).toBe(false);
  });

  it("requires matching registration passwords and does not accept a role", () => {
    expect(registrationSchema.safeParse({ name: "Ahmed", email: "a@example.com", password: "password123", confirmPassword: "different" }).success).toBe(false);
    expect(registrationSchema.safeParse({ name: "Ahmed", email: "a@example.com", password: "password123", confirmPassword: "password123", role: "ADMIN" }).success).toBe(false);
  });

  it("normalizes possible international registration phones and rejects ambiguous or malformed values", () => {
    const base = { name: "أحمد محمد", email: "AHMED@Example.com", password: "password123", confirmPassword: "password123" };
    expect(registrationSchema.parse({ ...base, phone: "+20 100 123 4567" })).toMatchObject({
      name: "أحمد محمد",
      email: "ahmed@example.com",
      phone: "+201001234567",
    });
    for (const phone of ["abc123", "++++123", "12", "01001234567", "1234567890123456789012345"]) {
      expect(registrationSchema.safeParse({ ...base, phone }).success).toBe(false);
    }
    expect(registrationSchema.parse({ ...base, phone: "" }).phone).toBe("");
  });
});
