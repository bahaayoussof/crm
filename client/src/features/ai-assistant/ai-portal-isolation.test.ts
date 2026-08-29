import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural guard: the AI Assistant must never be wired into the Customer
 * Portal. Visual hiding is not enough — no `/portal` source file may import the
 * `ai-assistant` feature at all.
 */
describe("AI Assistant is not wired into the Customer Portal", () => {
  const portalSources = () => {
    const dir = join(process.cwd(), "src/features/portal");
    return readdirSync(dir)
      .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
      .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
  };

  it("no client/src/features/portal source file imports the ai-assistant feature", () => {
    const offenders = portalSources()
      .filter((f) => /(?:ai-assistant|AiAssistant)/.test(f.text))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  it("no Portal source file imports the internal @mention typeahead / node or quick replies", () => {
    const offenders = portalSources()
      .filter((f) => /(?:ticket-mention-plugin|ticket-mention-node|TicketMentionPlugin|MentionNode|quick-repl|QuickReply)/.test(f.text))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });
});
