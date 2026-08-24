import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default("postgresql://postgres:postgres@localhost:5432/crm"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment configuration", z.treeifyError(result.error));
  throw new Error("Invalid environment configuration");
}

export const env = result.data;

