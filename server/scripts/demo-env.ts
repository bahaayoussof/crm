/**
 * Loader + guard for the isolated public-demo environment file.
 *
 * `server/.env.demo` holds the demo database connection and the demo-only flags.
 * It is deliberately SEPARATE from `server/.env` (normal local development) and
 * is git-ignored. Only the demo-specific npm scripts load it:
 *
 *   npm run db:demo:deploy   -> scripts/demo-migrate-deploy.ts
 *   npm run demo:seed        -> scripts/seed-demo.ts
 *   npm run demo:reset       -> scripts/demo-reset.ts
 *
 * Every one of those imports `./load-demo-env.js` as its FIRST import, which runs
 * {@link applyDemoEnv} + {@link assertDemoEnvLoaded} before `dotenv/config` or
 * `src/config/env.ts` evaluate. `npm run dev`, `npm start` and `npm run db:deploy`
 * never touch this file — `.env.demo` is strictly opt-in.
 *
 * Precedence for a demo command:
 *   - DATABASE_URL / DATABASE_ENV / DEMO_MODE / JWT_SECRET and every other key in
 *     `.env.demo` OVERRIDE whatever is already in the shell (stale exports cannot
 *     silently win), and are applied before `.env` is read so `.env` never wins.
 *   - DEMO_RESET_CONFIRM is the one deliberate exception: it is NEVER read from
 *     the file (stripped with a warning if present) and must come from the
 *     invoking shell / CI at reset time.
 *
 * This is not a Vercel concern: the deployed app gets its variables from Vercel
 * Project Settings and never reads `.env.demo`.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const DEMO_ENV_FILENAME = ".env.demo";

/** Absolute path to `server/.env.demo`, resolved from this file (not the cwd). */
export const DEMO_ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", DEMO_ENV_FILENAME);

/**
 * Set on the invoking shell / CI only — a fixed, deliberate "yes, wipe it" token
 * for `npm run demo:reset`. Storing it permanently in `.env.demo` would defeat
 * the point, so the loader refuses to take it from the file.
 */
export const RESET_CONFIRM_KEY = "DEMO_RESET_CONFIRM";

export class DemoEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoEnvError";
  }
}

/**
 * Parse `server/.env.demo` and apply it to `target` (default `process.env`).
 * Every key overrides an existing value except {@link RESET_CONFIRM_KEY}, which
 * is dropped (with a warning) so it can only ever be set from the shell.
 *
 * @throws {DemoEnvError} when the file does not exist — demo commands must never
 * silently fall back to `server/.env` / the development database.
 */
export function applyDemoEnv(
  target: NodeJS.ProcessEnv = process.env,
  path: string = DEMO_ENV_PATH,
): Record<string, string> {
  if (!existsSync(path)) {
    throw new DemoEnvError(
      `Demo environment file not found: server/${DEMO_ENV_FILENAME}\n` +
        `Copy server/${DEMO_ENV_FILENAME}.example and configure the isolated demo database first.`,
    );
  }

  const parsed = parse(readFileSync(path));

  if (RESET_CONFIRM_KEY in parsed) {
    delete parsed[RESET_CONFIRM_KEY];
    console.warn(
      `Ignoring ${RESET_CONFIRM_KEY} from server/${DEMO_ENV_FILENAME} — ` +
        "the reset confirmation must be passed in the shell/CI at reset time only.",
    );
  }

  for (const [key, value] of Object.entries(parsed)) {
    target[key] = value;
  }

  return parsed;
}

/**
 * After {@link applyDemoEnv}, verify the process really is pointed at an isolated
 * demo database. Safety comes from these explicit signals, never from inspecting
 * the database hostname. Does NOT check {@link RESET_CONFIRM_KEY} — that stays
 * the job of `config/demo.ts#assertDemoResetAllowed` for `demo:reset` only.
 *
 * @throws {DemoEnvError} when DEMO_MODE !== "true", DATABASE_ENV !== "demo", or
 * DATABASE_URL is missing.
 */
export function assertDemoEnvLoaded(source: NodeJS.ProcessEnv = process.env): void {
  const failures: string[] = [];
  if (source.DEMO_MODE !== "true") failures.push('DEMO_MODE must be "true"');
  if (source.DATABASE_ENV !== "demo") failures.push('DATABASE_ENV must be "demo"');
  if (!source.DATABASE_URL || source.DATABASE_URL.trim() === "") {
    failures.push("DATABASE_URL must be set");
  }
  if (failures.length > 0) {
    throw new DemoEnvError(
      `server/${DEMO_ENV_FILENAME} is not a valid isolated demo configuration: ` +
        failures.join("; ") +
        ". Refusing to run a demo command — a demo command must never touch the development database.",
    );
  }
}

/**
 * Side-effect entry used by the tsx demo scripts. Loads + validates `.env.demo`
 * or prints the reason and exits non-zero. Kept separate from the pure functions
 * above so tests can exercise them without killing the test process.
 */
export function bootstrapDemoEnv(): void {
  try {
    applyDemoEnv();
    assertDemoEnvLoaded();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
