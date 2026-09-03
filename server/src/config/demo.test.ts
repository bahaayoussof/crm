import { afterEach, describe, expect, it } from "vitest";
import { env } from "./env.js";
import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_RESET_CONFIRM_TOKEN,
  assertDemoResetAllowed,
  evaluateDemoResetGuard,
  isDemoMode,
  isDemoProtectedEmail,
  isDemoResetEnvironment,
  isIsolatedDemoDatabase,
  shouldSimulateOutboundProviders,
} from "./demo.js";

type MutableEnv = { DEMO_MODE?: boolean; DATABASE_ENV?: string };

function setDemo(value: boolean) {
  (env as MutableEnv).DEMO_MODE = value;
}
function setDbEnv(value: string | undefined) {
  (env as MutableEnv).DATABASE_ENV = value;
}

afterEach(() => {
  setDemo(false);
  setDbEnv(undefined);
});

describe("demo config", () => {
  it("is off by default", () => {
    expect(isDemoMode()).toBe(false);
    expect(shouldSimulateOutboundProviders()).toBe(false);
  });

  it("reflects DEMO_MODE when toggled on", () => {
    setDemo(true);
    expect(isDemoMode()).toBe(true);
    expect(shouldSimulateOutboundProviders()).toBe(true);
  });

  it("only protects the four seeded demo emails, and only in demo mode", () => {
    expect(DEMO_ACCOUNT_EMAILS).toHaveLength(4);
    for (const email of DEMO_ACCOUNT_EMAILS) {
      expect(isDemoProtectedEmail(email)).toBe(false); // demo mode still off
    }
    setDemo(true);
    for (const email of DEMO_ACCOUNT_EMAILS) {
      expect(isDemoProtectedEmail(email)).toBe(true);
      expect(isDemoProtectedEmail(email.toUpperCase())).toBe(true);
    }
    expect(isDemoProtectedEmail("someone.else@demo.local")).toBe(false);
    expect(isDemoProtectedEmail(null)).toBe(false);
    expect(isDemoProtectedEmail(undefined)).toBe(false);
  });

  it("gates the reset environment on BOTH DEMO_MODE and DATABASE_ENV=demo", () => {
    expect(isDemoResetEnvironment()).toBe(false);
    setDemo(true);
    expect(isDemoResetEnvironment()).toBe(false);
    setDbEnv("development");
    expect(isDemoResetEnvironment()).toBe(false);
    setDbEnv("demo");
    expect(isDemoResetEnvironment()).toBe(true);
    setDemo(false);
    expect(isDemoResetEnvironment()).toBe(false);
  });
});

describe("isIsolatedDemoDatabase (raw env)", () => {
  it("is true only when DEMO_MODE=true AND DATABASE_ENV=demo", () => {
    expect(isIsolatedDemoDatabase({})).toBe(false);
    expect(isIsolatedDemoDatabase({ DEMO_MODE: "true" })).toBe(false);
    expect(isIsolatedDemoDatabase({ DATABASE_ENV: "demo" })).toBe(false);
    expect(isIsolatedDemoDatabase({ DEMO_MODE: "true", DATABASE_ENV: "development" })).toBe(false);
    expect(isIsolatedDemoDatabase({ DEMO_MODE: "true", DATABASE_ENV: "demo" })).toBe(true);
    // NODE_ENV plays no part — a production-hosted demo still qualifies.
    expect(isIsolatedDemoDatabase({ DEMO_MODE: "true", DATABASE_ENV: "demo", NODE_ENV: "production" } as Record<string, string>)).toBe(true);
  });
});

describe("evaluateDemoResetGuard — every allowed/rejected combination", () => {
  const ok = {
    DEMO_MODE: "true",
    DATABASE_ENV: "demo",
    DEMO_RESET_CONFIRM: DEMO_RESET_CONFIRM_TOKEN,
  };

  it("allows ONLY when all three explicit signals are set, regardless of NODE_ENV", () => {
    expect(evaluateDemoResetGuard(ok)).toEqual({ allowed: true, failures: [] });
    // A production-hosted demo must still be resettable.
    expect(evaluateDemoResetGuard({ ...ok, NODE_ENV: "production" } as Record<string, string>).allowed).toBe(true);
  });

  it("rejects when DEMO_MODE is missing or not exactly \"true\"", () => {
    expect(evaluateDemoResetGuard({ ...ok, DEMO_MODE: undefined }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DEMO_MODE: "false" }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DEMO_MODE: "1" }).allowed).toBe(false);
  });

  it("rejects when DATABASE_ENV is not exactly \"demo\"", () => {
    expect(evaluateDemoResetGuard({ ...ok, DATABASE_ENV: undefined }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DATABASE_ENV: "development" }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DATABASE_ENV: "production" }).allowed).toBe(false);
  });

  it("rejects when DEMO_RESET_CONFIRM is missing or wrong", () => {
    expect(evaluateDemoResetGuard({ ...ok, DEMO_RESET_CONFIRM: undefined }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DEMO_RESET_CONFIRM: "yes" }).allowed).toBe(false);
    expect(evaluateDemoResetGuard({ ...ok, DEMO_RESET_CONFIRM: "reset_demo_database" }).allowed).toBe(false);
  });

  it("reports every failing condition by name", () => {
    const { failures } = evaluateDemoResetGuard({});
    expect(failures).toHaveLength(3);
    expect(failures.join(" ")).toMatch(/DEMO_MODE/);
    expect(failures.join(" ")).toMatch(/DATABASE_ENV/);
    expect(failures.join(" ")).toMatch(/DEMO_RESET_CONFIRM/);
  });

  it("assertDemoResetAllowed throws unless every condition passes, and names them", () => {
    expect(() => assertDemoResetAllowed(ok)).not.toThrow();
    expect(() => assertDemoResetAllowed({ DEMO_MODE: "true", DATABASE_ENV: "demo" })).toThrow(
      /DEMO_RESET_CONFIRM/,
    );
    expect(() => assertDemoResetAllowed({})).toThrow(/DEMO_MODE.*DATABASE_ENV.*DEMO_RESET_CONFIRM/s);
  });
});
