/**
 * `npm run db:demo:deploy` — apply Prisma migrations to the ISOLATED demo
 * database only.
 *
 *   1. Loads + validates `server/.env.demo` (via the first import below). A
 *      missing / non-demo file aborts before Prisma runs.
 *   2. Runs `prisma migrate deploy` with `DATABASE_URL` taken from `.env.demo`
 *      (an explicit env var wins over Prisma's own `.env` loading).
 *
 * Deployment-safe only: never `prisma migrate dev`, never `prisma migrate reset`.
 * `npm run db:deploy` is unchanged and still targets the normal environment.
 */
import "./load-demo-env.js";
import { spawnSync } from "node:child_process";

const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

if (result.error) {
  console.error("db:demo:deploy failed to start prisma:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
