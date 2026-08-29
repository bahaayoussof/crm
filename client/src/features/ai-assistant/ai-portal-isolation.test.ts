import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard: the AI Assistant must never be wired into the Customer
 * Portal. Visual hiding is not enough — no `/portal` source file may import the
 * `ai-assistant` feature at all.
 */
describe("AI Assistant is not wired into the Customer Portal", () => {
  it("no client/src/features/portal source file imports the ai-assistant feature", () => {
    const dir = join(process.cwd(), "src/features/portal");
    const offenders = readdirSync(dir)
      .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
      .filter((name) => /(?:ai-assistant|AiAssistant)/.test(readFileSync(join(dir, name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
