import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
const findUnique = mocks.findUnique;
vi.mock("../config/prisma.js", () => ({
  prisma: { user: { findUnique: mocks.findUnique } },
}));

import { env } from "../config/env.js";
import { AppError } from "../shared/errors/app-error.js";
import {
  assertDeletionAllowedInDemo,
  assertNotDemoProtectedEmail,
  assertNotDemoProtectedUserId,
} from "./demo-guard.js";

type MutableEnv = { DEMO_MODE?: boolean };
const setDemo = (value: boolean) => {
  (env as MutableEnv).DEMO_MODE = value;
};

beforeEach(() => {
  findUnique.mockReset();
});
afterEach(() => setDemo(false));

describe("demo-guard", () => {
  it("is inert when demo mode is off", async () => {
    setDemo(false);
    expect(() => assertNotDemoProtectedEmail("admin@demo.local")).not.toThrow();
    expect(() => assertDeletionAllowedInDemo("Team")).not.toThrow();
    await expect(assertNotDemoProtectedUserId("u1")).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  describe("in demo mode", () => {
    beforeEach(() => setDemo(true));

    it("rejects mutation of a protected demo email with DEMO_PROTECTED_RESOURCE", () => {
      try {
        assertNotDemoProtectedEmail("Manager@Demo.Local");
        throw new Error("expected to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).code).toBe("DEMO_PROTECTED_RESOURCE");
      }
    });

    it("allows mutation of a non-demo account", () => {
      expect(() => assertNotDemoProtectedEmail("real.user@example.com")).not.toThrow();
    });

    it("blocks structural deletion", () => {
      expect(() => assertDeletionAllowedInDemo("Department")).toThrow(AppError);
    });

    it("resolves a user id to its email before checking", async () => {
      findUnique.mockResolvedValueOnce({ email: "agent@demo.local" });
      await expect(assertNotDemoProtectedUserId("u1")).rejects.toMatchObject({
        code: "DEMO_PROTECTED_RESOURCE",
      });

      findUnique.mockResolvedValueOnce({ email: "someone@example.com" });
      await expect(assertNotDemoProtectedUserId("u2")).resolves.toBeUndefined();
    });
  });
});
