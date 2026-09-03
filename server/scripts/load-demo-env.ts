/**
 * Side-effect module: importing it loads and validates `server/.env.demo`.
 *
 * MUST be the FIRST import in every demo script (`seed-demo.ts`,
 * `demo-reset.ts`, `demo-migrate-deploy.ts`) so it evaluates before
 * `dotenv/config` and `src/config/env.ts` — making `.env.demo` authoritative for
 * DATABASE_URL / DATABASE_ENV / DEMO_MODE / JWT_SECRET regardless of stale shell
 * exports or the contents of `server/.env`.
 *
 * A missing `server/.env.demo`, or one that is not a valid isolated demo config,
 * exits the process non-zero with a clear message — never a silent fall back to
 * the development database.
 */
import { bootstrapDemoEnv } from "./demo-env.js";

bootstrapDemoEnv();
