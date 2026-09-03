/**
 * Coverage for the `.env.demo` loader/guard (scripts/demo-env.ts) and its
 * interaction with the untouched three-signal reset guard.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyDemoEnv, assertDemoEnvLoaded, DemoEnvError } from "./demo-env.js";
import { evaluateDemoResetGuard } from "../src/config/demo.js";

let dir: string;
const envFile = () => join(dir, ".env.demo");
const write = (contents: string) => writeFileSync(envFile(), contents);

const VALID_DEMO_ENV = [
  'DATABASE_URL="postgresql://demo:demo@demo-host/neondb?sslmode=require"',
  "DATABASE_ENV=demo",
  "DEMO_MODE=true",
  'JWT_SECRET="demo-only-secret-that-is-at-least-32-characters"',
].join("\n");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "demo-env-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("applyDemoEnv — file loading", () => {
  it("loads .env.demo values into the target env", () => {
    write(VALID_DEMO_ENV);
    const target: NodeJS.ProcessEnv = {};

    applyDemoEnv(target, envFile());

    expect(target.DATABASE_URL).toBe("postgresql://demo:demo@demo-host/neondb?sslmode=require");
    expect(target.DATABASE_ENV).toBe("demo");
    expect(target.DEMO_MODE).toBe("true");
    expect(target.JWT_SECRET).toBe("demo-only-secret-that-is-at-least-32-characters");
  });

  it("overrides a stale value already present in the shell env", () => {
    write(VALID_DEMO_ENV);
    const target: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/crm",
      DATABASE_ENV: "development",
      DEMO_MODE: "false",
    };

    applyDemoEnv(target, envFile());

    expect(target.DATABASE_URL).toBe("postgresql://demo:demo@demo-host/neondb?sslmode=require");
    expect(target.DATABASE_ENV).toBe("demo");
    expect(target.DEMO_MODE).toBe("true");
  });

  it("leaves unrelated shell variables untouched (no fall through to real .env)", () => {
    write(VALID_DEMO_ENV);
    const target: NodeJS.ProcessEnv = { PATH: "/usr/bin", HOME: "/home/dev" };

    applyDemoEnv(target, envFile());

    expect(target.PATH).toBe("/usr/bin");
    expect(target.HOME).toBe("/home/dev");
  });

  it("never takes DEMO_RESET_CONFIRM from the file", () => {
    write(`${VALID_DEMO_ENV}\nDEMO_RESET_CONFIRM=RESET_DEMO_DATABASE`);
    const target: NodeJS.ProcessEnv = {};

    const parsed = applyDemoEnv(target, envFile());

    expect(target.DEMO_RESET_CONFIRM).toBeUndefined();
    expect(parsed.DEMO_RESET_CONFIRM).toBeUndefined();
  });

  it("fails clearly when server/.env.demo is missing", () => {
    expect(() => applyDemoEnv({}, envFile())).toThrow(DemoEnvError);
    expect(() => applyDemoEnv({}, envFile())).toThrow(
      /Demo environment file not found: server\/\.env\.demo/,
    );
    expect(() => applyDemoEnv({}, envFile())).toThrow(/Copy server\/\.env\.demo\.example/);
  });
});

describe("assertDemoEnvLoaded — isolated-demo validation", () => {
  it("passes for a valid isolated demo configuration", () => {
    expect(() =>
      assertDemoEnvLoaded({
        DATABASE_URL: "postgresql://demo/neondb",
        DATABASE_ENV: "demo",
        DEMO_MODE: "true",
      }),
    ).not.toThrow();
  });

  it("rejects DEMO_MODE !== true", () => {
    expect(() =>
      assertDemoEnvLoaded({ DATABASE_URL: "x", DATABASE_ENV: "demo", DEMO_MODE: "false" }),
    ).toThrow(/DEMO_MODE must be "true"/);
  });

  it("rejects DATABASE_ENV !== demo", () => {
    expect(() =>
      assertDemoEnvLoaded({ DATABASE_URL: "x", DATABASE_ENV: "development", DEMO_MODE: "true" }),
    ).toThrow(/DATABASE_ENV must be "demo"/);
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() =>
      assertDemoEnvLoaded({ DATABASE_ENV: "demo", DEMO_MODE: "true" }),
    ).toThrow(/DATABASE_URL must be set/);
  });
});

describe("demo:reset guard is unchanged by .env.demo loading", () => {
  it(".env.demo alone (no DEMO_RESET_CONFIRM) cannot authorize a reset", () => {
    write(VALID_DEMO_ENV);
    const target: NodeJS.ProcessEnv = {};
    applyDemoEnv(target, envFile());
    assertDemoEnvLoaded(target);

    const { allowed, failures } = evaluateDemoResetGuard(target);

    expect(allowed).toBe(false);
    expect(failures).toContain('DEMO_RESET_CONFIRM must be "RESET_DEMO_DATABASE"');
  });

  it("still needs all three signals — .env.demo + shell DEMO_RESET_CONFIRM", () => {
    write(VALID_DEMO_ENV);
    const target: NodeJS.ProcessEnv = { DEMO_RESET_CONFIRM: "RESET_DEMO_DATABASE" };
    applyDemoEnv(target, envFile());

    expect(evaluateDemoResetGuard(target).allowed).toBe(true);
  });
});
