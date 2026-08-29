import { getAiConfig } from "./ai.config.js";
import { OpenRouterProvider } from "./openrouter-provider.js";
import type { AiProvider } from "./ai.types.js";

/** Thrown when no AI provider is configured. Mapped to `503 AI_NOT_CONFIGURED`. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI provider is not configured");
    this.name = "AiNotConfiguredError";
  }
}

export type AiProviderErrorReason =
  | "TIMEOUT"
  | "PROVIDER_UNREACHABLE"
  | "PROVIDER_REJECTED"
  | "RATE_LIMITED"
  | "INVALID_OUTPUT";

/**
 * Normalized provider failure. Concrete adapters translate every vendor HTTP
 * error, network error, abort, and unparseable response into one of these — the
 * raw provider response never leaves the adapter.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly reason: AiProviderErrorReason,
    message: string,
    /** Only for `RATE_LIMITED` — seconds the client should wait before retrying. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

let cached: AiProvider | null = null;
let cachedKey = "";

/**
 * Returns the configured provider adapter (cached per provider+model). Business
 * logic depends only on the `AiProvider` interface; this factory is the only
 * place a concrete adapter is named.
 */
export function getAiProvider(): AiProvider {
  const config = getAiConfig();
  if (!config) throw new AiNotConfiguredError();

  const key = `${config.provider}:${config.model}`;
  if (cached && cachedKey === key) return cached;

  if (config.provider === "openrouter") {
    cached = new OpenRouterProvider(config);
    cachedKey = key;
    return cached;
  }

  // Unreachable while AI_PROVIDER's enum has a single member — kept explicit so a
  // future provider must be wired here rather than silently falling through.
  throw new AiNotConfiguredError();
}

/** Test helper — drops the cached adapter so env changes take effect. */
export function __resetAiProviderCache(): void {
  cached = null;
  cachedKey = "";
}
