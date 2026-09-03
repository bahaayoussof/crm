import { env } from "./env.js";

/**
 * Single source of truth for public-demo behaviour on the server.
 *
 * The demo is not a separate app or a mocked UI: it is this exact CRM booted
 * with `DEMO_MODE=true`. Only three things change, each gated through a helper
 * here so the check never has to be spelled out as `process.env.DEMO_MODE` in
 * feature code:
 *
 *  1. Outbound provider transports are simulated at their adapter boundary
 *     (`shouldSimulateOutboundProviders()`) — the local `TicketMessage`, history,
 *     notifications and realtime events are still written exactly as in
 *     production; only the network call to Meta / TextBee / Resend is skipped.
 *  2. The four seeded demo accounts are protected from destructive mutation
 *     (`isDemoProtectedEmail()` + `middleware/demo-guard.ts`).
 *  3. AI actions run under a much tighter per-user rate limit.
 *
 * When `DEMO_MODE` is unset or "false" every helper below is inert and the
 * application behaves identically to before.
 */
export function isDemoMode(): boolean {
  return env.DEMO_MODE;
}

/** True when outbound WhatsApp / SMS / Email network calls must be simulated. */
export function shouldSimulateOutboundProviders(): boolean {
  return env.DEMO_MODE;
}

/**
 * The fixed identities created by `scripts/seed-demo.ts`. Lower-cased; compare
 * with `isDemoProtectedEmail`. Kept in sync with the seed script and the docs.
 */
export const DEMO_ACCOUNT_EMAILS = [
  "admin@demo.local",
  "manager@demo.local",
  "agent@demo.local",
  "customer@demo.local",
] as const;

export type DemoAccountEmail = (typeof DEMO_ACCOUNT_EMAILS)[number];

/**
 * True only when demo mode is on AND the email is one of the shared demo
 * identities. Off outside demo mode, so production account management is never
 * affected.
 */
export function isDemoProtectedEmail(email: string | null | undefined): boolean {
  if (!env.DEMO_MODE || !email) return false;
  return (DEMO_ACCOUNT_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

/**
 * Non-destructive "this process is pointed at the isolated demo database" check
 * (`DEMO_MODE=true` AND `DATABASE_ENV=demo`). Used by the seed scripts to allow a
 * deliberate demo reseed to run even under `NODE_ENV=production` (the Vercel
 * demo's runtime NODE_ENV), while a plain production seed of a real database
 * stays blocked. Does NOT by itself authorise the destructive TRUNCATE — see
 * {@link evaluateDemoResetGuard}.
 */
export function isDemoResetEnvironment(): boolean {
  return env.DEMO_MODE && env.DATABASE_ENV === "demo";
}

/** Raw-env variant of {@link isDemoResetEnvironment} for the standalone scripts. */
export function isIsolatedDemoDatabase(
  source: { DEMO_MODE?: string; DATABASE_ENV?: string } = process.env,
): boolean {
  return source.DEMO_MODE === "true" && source.DATABASE_ENV === "demo";
}

/**
 * The exact value `DEMO_RESET_CONFIRM` must hold for `npm run demo:reset` to
 * proceed. A fixed, meaningless-by-accident string so it can only be set on
 * purpose.
 */
export const DEMO_RESET_CONFIRM_TOKEN = "RESET_DEMO_DATABASE";

export interface DemoResetGuardSource {
  DEMO_MODE?: string | undefined;
  DATABASE_ENV?: string | undefined;
  DEMO_RESET_CONFIRM?: string | undefined;
}

/**
 * Pure evaluation of the destructive-reset guard. `demo:reset` wipes and
 * re-seeds every table, so it is gated on THREE independent, deliberate signals
 * that no real environment ever sets together:
 *
 *   1. `DEMO_MODE=true`            — the app is running in public-demo mode
 *   2. `DATABASE_ENV=demo`        — the connection is tagged as the demo database
 *   3. `DEMO_RESET_CONFIRM=RESET_DEMO_DATABASE` — an explicit "yes, wipe it"
 *
 * Crucially this is independent of `NODE_ENV`: the hosted demo runs
 * `NODE_ENV=production`, so gating on `NODE_ENV !== "production"` (the old rule)
 * made the real demo database impossible to reset. Safety now comes from the
 * three explicit signals, not from the runtime mode.
 */
export function evaluateDemoResetGuard(source: DemoResetGuardSource): {
  allowed: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  if (source.DEMO_MODE !== "true") failures.push('DEMO_MODE must be "true"');
  if (source.DATABASE_ENV !== "demo") failures.push('DATABASE_ENV must be "demo"');
  if (source.DEMO_RESET_CONFIRM !== DEMO_RESET_CONFIRM_TOKEN) {
    failures.push(`DEMO_RESET_CONFIRM must be "${DEMO_RESET_CONFIRM_TOKEN}"`);
  }
  return { allowed: failures.length === 0, failures };
}

/** Throw unless every {@link evaluateDemoResetGuard} condition is met. */
export function assertDemoResetAllowed(source: DemoResetGuardSource = process.env): void {
  const { allowed, failures } = evaluateDemoResetGuard(source);
  if (!allowed) {
    throw new Error(
      "demo:reset refused — it TRUNCATEs and re-seeds every table and must only " +
        "run against the isolated demo database. Fix: " +
        failures.join("; ") +
        ". A real development or production database can never satisfy all three.",
    );
  }
}
