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
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration", z.treeifyError(result.error));
  throw new Error("Invalid environment configuration");
}

export const env = result.data;

