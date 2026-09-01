import "dotenv/config";
import { z } from "zod";

const clientUrlsSchema = z.string()
  .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
  .pipe(z.array(z.string().url()).min(1));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CLIENT_URLS: clientUrlsSchema.optional(),
  // Public base URL of the web client, used to build absolute links in emails
  // (e.g. the password-reset URL). Defaults to CLIENT_URL when unset.
  APP_URL: z.string().url().optional(),
  // Transactional email (server/src/modules/email). Optional: when RESEND_API_KEY
  // or EMAIL_FROM is unset the email service falls back to a log transport that
  // prints the message (incl. the reset URL in development) to the server console.
  // Never exposed to the browser.
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  EMAIL_INBOUND_ADDRESS: z.string().email().optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_FROM_NAME: z.string().trim().min(1).max(100).optional(),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/crm"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters")
    .default("development-jwt-secret-key-must-be-at-least-32-characters-long"),
  // Private Vercel Blob store token for secure attachment storage (feature/attachments).
  // Optional: when unset, attachment upload/download return a structured STORAGE_UNAVAILABLE error.
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  // Shared only with the deployment scheduler. It never authenticates product users.
  CRON_SECRET: z.string().min(32, "CRON_SECRET must be at least 32 characters").optional(),
  // WhatsApp Cloud API integration (server/src/modules/integrations/whatsapp).
  // All optional: when unset the rest of the CRM is unaffected and WhatsApp
  // transport reports a structured WHATSAPP_NOT_CONFIGURED error when invoked.
  // Never exposed to the browser.
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  WHATSAPP_API_VERSION: z.string().regex(/^v\d+\.\d+$/, "WHATSAPP_API_VERSION must look like v22.0").default("v22.0"),
  // TextBee Cloud SMS integration. Optional at startup; enforced only when SMS
  // transport/webhook endpoints are used. Server-side only.
  TEXTBEE_API_KEY: z.string().min(1).optional(),
  TEXTBEE_DEVICE_ID: z.string().min(1).optional(),
  TEXTBEE_BASE_URL: z.string().url().default("https://api.textbee.dev"),
  TEXTBEE_WEBHOOK_SECRET: z.string().min(1).optional(),
  // AI Assistant (server/src/modules/ai) — internal agent-assistance layer only.
  // All optional: when AI_PROVIDER / AI_API_KEY / AI_MODEL are not all set (or
  // AI_PROVIDER names an unsupported vendor), the AI endpoints return a structured
  // AI_NOT_CONFIGURED error and the rest of the CRM is unaffected. AI_PROVIDER is a
  // free string here — an unknown value must NOT crash startup; `ai.config.ts`
  // decides support. Never exposed to the browser. AI_MODEL is the only place the
  // model is chosen — business logic never hardcodes it.
  AI_PROVIDER: z.string().min(1).optional(),
  AI_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(20_000),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration", z.treeifyError(result.error));
  throw new Error("Invalid environment configuration");
}

export const env = result.data;

