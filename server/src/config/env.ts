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
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration", z.treeifyError(result.error));
  throw new Error("Invalid environment configuration");
}

export const env = result.data;

