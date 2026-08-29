import { env } from "../../config/env.js";
import type { AiConfig } from "./ai.config.js";
import { AiProviderError } from "./ai-provider.js";
import type { AiProvider, StructuredRequest } from "./ai.types.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Fallback wait when a 429 carries no usable `Retry-After`. */
const DEFAULT_RETRY_AFTER_SECONDS = 5;
/** Headroom kept for the retry request itself when deciding whether to retry. */
const RETRY_BUDGET_MARGIN_MS = 2_000;

interface OpenRouterErrorBody {
  message?: string;
  code?: number | string;
  type?: string;
  metadata?: {
    provider_name?: string;
    /** Upstream provider's own error payload — a diagnostic, never our request. */
    raw?: unknown;
    [key: string]: unknown;
  };
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  /** OpenRouter returns `error` on non-2xx and, for mid-stream upstream failures,
   * sometimes inside a 200 body. */
  error?: OpenRouterErrorBody;
}

function clip(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…(${text.length})` : text;
}

/** Parse an HTTP `Retry-After` value (delta-seconds or HTTP-date) → seconds. */
function parseRetryAfter(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
  return undefined;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * OpenRouter (https://openrouter.ai) adapter — the first concrete `AiProvider`.
 *
 * Every OpenRouter-specific detail is contained here: the endpoint, the
 * `Authorization` header, the optional ranking headers, the chat-completions
 * message format, `response_format` JSON-schema mode, the `model` parameter,
 * response parsing, HTTP error mapping, timeout/abort behavior, and a single
 * bounded retry on HTTP 429. The model is whatever `AI_MODEL` resolves to — this
 * class never assumes a specific model and never silently substitutes one.
 */
export class OpenRouterProvider implements AiProvider {
  readonly name = "openrouter";
  readonly model: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: AiConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs;
  }

  async generateStructured(request: StructuredRequest): Promise<unknown> {
    const requestBody = {
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: request.schemaName,
          strict: true,
          schema: request.schema,
        },
      },
    };

    // Structural diagnostic only — shape, not content. No prompt, no key.
    console.info(
      `[ai] openrouter request provider=openrouter model=${this.model} messages=${requestBody.messages.length} response_format=${requestBody.response_format.type} schema=${request.schemaName} strict=${requestBody.response_format.json_schema.strict}`,
    );

    const deadline = Date.now() + this.timeoutMs;
    const body = JSON.stringify(requestBody);

    try {
      return await this.attempt(body, deadline);
    } catch (error) {
      // One bounded retry, 429 only, only if the wait + a retry fit the budget.
      if (
        error instanceof AiProviderError &&
        error.reason === "RATE_LIMITED" &&
        typeof error.retryAfterSeconds === "number"
      ) {
        const waitMs = error.retryAfterSeconds * 1_000;
        const remaining = deadline - Date.now();
        if (waitMs + RETRY_BUDGET_MARGIN_MS <= remaining) {
          console.warn(`[ai] openrouter 429 — retrying once after ${error.retryAfterSeconds}s`);
          await sleep(waitMs);
          return await this.attempt(body, deadline);
        }
      }
      throw error;
    }
  }

  /** One HTTP round-trip. Its abort budget is whatever remains until `deadline`. */
  private async attempt(body: string, deadline: number): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          // Optional OpenRouter attribution headers — no secret material.
          "HTTP-Referer": env.CLIENT_URL,
          "X-Title": "Customer Support CRM",
        },
        body,
      });
    } catch (cause) {
      const error = cause as Error;
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new AiProviderError("TIMEOUT", `OpenRouter request timed out after ${this.timeoutMs}ms`);
      }
      throw new AiProviderError("PROVIDER_UNREACHABLE", `OpenRouter request failed: ${error.message}`);
    }

    const payload = (await response.json().catch(() => null)) as OpenRouterResponse | null;
    const inBodyErrorCode = Number(payload?.error?.code);
    const isRateLimited = response.status === 429 || (response.ok && inBodyErrorCode === 429);

    if (isRateLimited) {
      this.logRejection(response.status, payload?.error);
      const retryAfterSeconds =
        parseRetryAfter(response.headers.get("retry-after")) ?? DEFAULT_RETRY_AFTER_SECONDS;
      throw new AiProviderError(
        "RATE_LIMITED",
        `OpenRouter is rate-limited (status ${response.status})`,
        retryAfterSeconds,
      );
    }

    if (!response.ok) {
      this.logRejection(response.status, payload?.error);
      const code = payload?.error?.code ?? response.status;
      const brief = payload?.error?.message ?? `HTTP ${response.status}`;
      throw new AiProviderError(
        "PROVIDER_REJECTED",
        `OpenRouter rejected the request (status ${response.status}, code ${code}): ${brief}`,
      );
    }

    // OpenRouter can also report an upstream-provider failure inside a 200 body.
    if (payload?.error) {
      this.logRejection(response.status, payload.error);
      throw new AiProviderError(
        "PROVIDER_REJECTED",
        `OpenRouter returned an error in a ${response.status} response (code ${payload.error.code ?? "?"}): ${payload.error.message ?? "unknown"}`,
      );
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiProviderError("INVALID_OUTPUT", "OpenRouter response contained no content");
    }

    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new AiProviderError("INVALID_OUTPUT", "OpenRouter response was not valid JSON");
    }
  }

  /**
   * Safe server-side diagnostic for a rejected request. Logs only the HTTP
   * status, OpenRouter's error code/type/message, the upstream provider name,
   * and a clipped copy of the upstream provider's own error payload (a
   * response-side diagnostic — never our request body, prompt, key, or headers).
   */
  private logRejection(httpStatus: number, error: OpenRouterErrorBody | undefined): void {
    console.error(
      [
        "[ai] openrouter rejected request",
        "provider=openrouter",
        `model=${this.model}`,
        `status=${httpStatus}`,
        `code=${error?.code ?? "(none)"}`,
        `type=${error?.type ?? "(none)"}`,
        `upstreamProvider=${error?.metadata?.provider_name ?? "(none)"}`,
        `message=${clip(error?.message ?? "(none)", 400)}`,
        `upstreamRaw=${clip(error?.metadata?.raw ?? "(none)", 600)}`,
      ].join(" "),
    );
  }
}
