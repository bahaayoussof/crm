/**
 * One-shot AI provider diagnostic. Runs a SINGLE real CLASSIFY request through
 * the exact OpenRouterProvider path (same model, same response_format) using
 * dummy ticket data — no DB, no server, no real customer content.
 *
 * Run from `server/`:  npx tsx scripts/ai-diagnose.ts
 *
 * Never prints the API key. Not part of the build or test suites.
 */
import "dotenv/config";
import { getAiConfig } from "../src/modules/ai/ai.config.js";
import { OpenRouterProvider } from "../src/modules/ai/openrouter-provider.js";
import { AiProviderError } from "../src/modules/ai/ai-provider.js";
import { AI_JSON_SCHEMAS } from "../src/modules/ai/ai.schema.js";
import { buildClassificationPrompt } from "../src/modules/ai/ai-prompts.js";
import type { AiTicketContext } from "../src/modules/ai/ai.types.js";

const config = getAiConfig();
if (!config) {
  console.error("[diag] AI is not configured — set AI_PROVIDER=openrouter, AI_API_KEY, AI_MODEL in server/.env");
  process.exit(1);
}
console.log(`[diag] provider=${config.provider} model=${config.model} timeoutMs=${config.timeoutMs} apiKeyLength=${config.apiKey.length}`);

const context: AiTicketContext = {
  ticket: {
    reference: "diag-0001",
    subject: "Cannot reset password",
    description: "Every reset link I request expires the moment I click it.",
    status: "OPEN",
    category: null,
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
  },
  customerDisplayName: "Diagnostic Customer",
  publicMessages: [
    { authorType: "CUSTOMER", body: "My reset link keeps expiring immediately.", createdAt: "2026-08-29T00:00:00.000Z" },
  ],
  internalNotes: [],
  truncated: false,
};
const categories = [
  { id: "cat-auth", name: "Authentication" },
  { id: "cat-billing", name: "Billing" },
];

const { system, prompt } = buildClassificationPrompt(context, categories);
const provider = new OpenRouterProvider(config);

try {
  const result = await provider.generateStructured({
    system,
    prompt,
    schema: AI_JSON_SCHEMAS.CLASSIFY as unknown as Record<string, unknown>,
    schemaName: "ticket_classification",
  });
  console.log("[diag] SUCCESS result=", JSON.stringify(result));
} catch (error) {
  if (error instanceof AiProviderError) {
    console.log(`[diag] AiProviderError reason=${error.reason} message="${error.message}"`);
  } else {
    console.log("[diag] unexpected error:", error);
  }
  process.exitCode = 2;
}
