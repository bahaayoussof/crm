import type { AuthUser } from "@/features/auth/auth.types";

/**
 * Client-side public-demo flag. Mirrors the server's `DEMO_MODE`, set at build
 * time via `VITE_DEMO_MODE=true` on the demo Vercel project only. Everywhere
 * else it is `false` and every demo-only affordance (the quick-login panel, the
 * environment banner) simply does not render.
 *
 * This is a build-time constant, not a feature flag fetched at runtime — keep it
 * that way so tree-shaking can drop demo UI from a normal production bundle.
 */
export const isDemoMode: boolean = import.meta.env.VITE_DEMO_MODE === "true";

export type DemoRole = "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER";

export interface DemoAccount {
  role: DemoRole;
  email: string;
  /** Public, intentionally non-personal. Safe to show in the UI. */
  password: string;
  /** i18n key for the button / label copy. */
  labelKey: string;
}

/**
 * The fixed identities created by `server/scripts/seed-demo.ts`. Credentials are
 * public by design — the whole point is that anyone can try each role. Keep this
 * list in sync with `server/src/config/demo.ts#DEMO_ACCOUNT_EMAILS`.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { role: "ADMIN", email: "admin@demo.local", password: "Demo123!", labelKey: "demo.login.asAdmin" },
  { role: "MANAGER", email: "manager@demo.local", password: "Demo123!", labelKey: "demo.login.asManager" },
  { role: "AGENT", email: "agent@demo.local", password: "Demo123!", labelKey: "demo.login.asAgent" },
  { role: "CUSTOMER", email: "customer@demo.local", password: "Demo123!", labelKey: "demo.login.asCustomer" },
] as const;

/** True when `user` is one of the shared demo accounts (used to soften some UI copy). */
export function isDemoAccount(user: Pick<AuthUser, "email"> | null | undefined): boolean {
  if (!isDemoMode || !user?.email) return false;
  return DEMO_ACCOUNTS.some((account) => account.email === user.email.toLowerCase());
}
