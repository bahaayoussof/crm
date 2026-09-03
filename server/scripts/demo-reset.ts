/**
 * Deterministic public-demo reset.
 *
 *   1. Hard guard: refuses unless ALL THREE of
 *        DEMO_MODE=true  AND  DATABASE_ENV=demo  AND
 *        DEMO_RESET_CONFIRM=RESET_DEMO_DATABASE
 *      are set (see config/demo.ts#evaluateDemoResetGuard). The guard is
 *      independent of NODE_ENV so the real Vercel-hosted demo (which runs
 *      NODE_ENV=production) can still be reseeded on purpose, while no
 *      development or production database can ever match all three.
 *   2. Truncates every application table (schema + _prisma_migrations kept — NO
 *      `prisma migrate reset`, no dropped schema).
 *   3. Re-runs the public-demo seed: baseline data + the four demo accounts +
 *      the demo support scenarios.
 *
 * This is an application-level reset. It never touches migrations. Run it from a
 * trusted machine or CI with DATABASE_URL pointed at the isolated demo database.
 *
 * Env: loads `server/.env.demo` first (see scripts/demo-env.ts). That file
 * supplies DATABASE_URL / DATABASE_ENV / DEMO_MODE / JWT_SECRET; it must NOT
 * contain DEMO_RESET_CONFIRM — the reset token is passed in the shell / CI at
 * run time and is still enforced by assertDemoResetAllowed below.
 */
import "./load-demo-env.js";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { assertDemoResetAllowed } from "../src/config/demo.js";
import { seedDemo } from "./seed-demo.js";

assertDemoResetAllowed(process.env);

const prisma = new PrismaClient();

async function truncateAll() {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    "select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'",
  );
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`Truncated ${rows.length} tables.`);
}

async function main() {
  console.log("=== DEMO RESET (DATABASE_ENV=demo) ===");
  await truncateAll();
  await seedDemo();
  console.log("=== DEMO RESET COMPLETE ===");
}

main()
  .catch((e) => {
    console.error("demo reset failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
