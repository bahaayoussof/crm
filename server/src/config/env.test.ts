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

  // Production runtime + demo application mode are NOT mutually exclusive: the
  // Vercel-hosted public demo runs NODE_ENV=production AND DEMO_MODE=true. The
  // only production startup assertion is JWT_SECRET + DATABASE_URL — external
  // provider credentials (WhatsApp / TextBee / Resend / AI / Blob) are never
  // required to boot, in demo mode or otherwise, because those transports fail
  // closed with a structured error (and are simulated in demo mode). This test
  // pins that: a production env with real JWT/DB and zero provider creds boots.
  it("does not require any external provider credential to start in production (demo-safe)", () => {
    expect(() =>
      assertProductionSecretsConfigured("production", {
        JWT_SECRET: goodSecret,
        DATABASE_URL: goodDbUrl,
        // no RESEND_API_KEY / WHATSAPP_* / TEXTBEE_* / AI_API_KEY / BLOB_READ_WRITE_TOKEN
      }),
    ).not.toThrow();
  });
});
