import { env } from "../../config/env.js";

/**
 * Resolved AI configuration. Mirrors the WhatsApp integration pattern: every var
 * is optional in `config/env.ts`, and the feature is simply unavailable (not
 * broken) when the required ones are missing.
 */
/** The only provider vendor with a concrete adapter today. */
export const SUPPORTED_AI_PROVIDER = "openrouter";

export interface AiConfig {
  provider: typeof SUPPORTED_AI_PROVIDER;
  apiKey: string;
  /** The single source of truth for the model. Never hardcoded in logic. */
  model: string;
  timeoutMs: number;
}

/**
 * Returns the config only when the AI feature is fully and supportedly
 * configured, else `null` (→ `AI_NOT_CONFIGURED`, CRM unaffected). An unknown
 * `AI_PROVIDER` disables the feature with a one-line server diagnostic — it is
 * never silently routed to OpenRouter and never crashes the app.
 */
export function getAiConfig(): AiConfig | null {
  if (!env.AI_PROVIDER || !env.AI_API_KEY || !env.AI_MODEL) return null;
  if (env.AI_PROVIDER !== SUPPORTED_AI_PROVIDER) {
    console.warn(
      `[ai] unsupported AI_PROVIDER "${env.AI_PROVIDER}" — the AI assistant is disabled. Set AI_PROVIDER=${SUPPORTED_AI_PROVIDER}.`,
    );
    return null;
  }
  return {
    provider: SUPPORTED_AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    model: env.AI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}
