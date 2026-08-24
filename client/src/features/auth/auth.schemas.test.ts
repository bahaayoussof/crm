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
});
