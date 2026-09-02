import { describe, expect, it } from "vitest";
import { DEV_DATABASE_URL, DEV_JWT_SECRET, assertProductionSecretsConfigured } from "./env.js";

describe("assertProductionSecretsConfigured", () => {
  const goodSecret = "a-real-production-jwt-secret-value-32-chars-min-xx";
  const goodDbUrl = "postgresql://user:pw@prod-db.example.com:5432/crm";

  it("does nothing outside production, even with dev defaults", () => {
    expect(() =>
      assertProductionSecretsConfigured("development", {
        JWT_SECRET: DEV_JWT_SECRET,
        DATABASE_URL: DEV_DATABASE_URL,
      }),
    ).not.toThrow();
    expect(() => assertProductionSecretsConfigured("test", {})).not.toThrow();
  });

  it("passes in production when both secrets are real", () => {
    expect(() =>
      assertProductionSecretsConfigured("production", {
        JWT_SECRET: goodSecret,
        DATABASE_URL: goodDbUrl,
      }),
    ).not.toThrow();
  });

  it("throws in production when JWT_SECRET is unset (schema would fill the dev default)", () => {
    expect(() =>
      assertProductionSecretsConfigured("production", { DATABASE_URL: goodDbUrl }),
    ).toThrow(/JWT_SECRET/);
  });

  it("throws in production when JWT_SECRET is the shipped dev default", () => {
    expect(() =>
      assertProductionSecretsConfigured("production", {
        JWT_SECRET: DEV_JWT_SECRET,
        DATABASE_URL: goodDbUrl,
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it("throws in production when DATABASE_URL is the shipped dev default", () => {
    expect(() =>
      assertProductionSecretsConfigured("production", {
        JWT_SECRET: goodSecret,
        DATABASE_URL: DEV_DATABASE_URL,
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("names every offending variable in one message", () => {
    expect(() => assertProductionSecretsConfigured("production", {})).toThrow(
      /JWT_SECRET.*DATABASE_URL|DATABASE_URL.*JWT_SECRET/,
    );
  });
});
