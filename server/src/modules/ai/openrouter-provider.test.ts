import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "./ai-provider.js";
import { OpenRouterProvider } from "./openrouter-provider.js";

const REQUEST = {
  system: "sys",
  prompt: "usr",
  schema: { type: "object" } as Record<string, unknown>,
  schemaName: "diag",
};

/** Minimal stand-in for the parts of `Response` the adapter uses. */
function fakeResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const OK_BODY = { choices: [{ message: { content: '{"ok":true}' } }] };
const RATE_BODY = {
  error: {
    code: 429,
    message: "Provider returned error",
    metadata: { provider_name: "UpstreamVendorName", raw: "UPSTREAM_RAW_DETAIL_do_not_leak" },
  },
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const provider = (timeoutMs = 20_000) =>
  new OpenRouterProvider({ provider: "openrouter", apiKey: "test-key", model: "test-model", timeoutMs });

describe("OpenRouterProvider — 429 resilience", () => {
  it("retries exactly once on a 429 and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "0" }))
      .mockResolvedValueOnce(fakeResponse(200, OK_BODY));

    const result = await provider().generateStructured(REQUEST);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry when the 429 persists", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "0" }))
      .mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "0" }));

    const error = await provider()
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.reason).toBe("RATE_LIMITED");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when Retry-After exceeds the remaining timeout budget", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "3600" }));

    const error = await provider()
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.reason).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(3600);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses a default Retry-After of 5s when the 429 carries no header, and skips the retry on a tiny budget", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(429, RATE_BODY));

    const error = await provider(3_000)
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error.reason).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(1); // 5s + margin > 3s budget → no retry
  });

  it("treats an upstream 429 inside a 200 body as rate-limited", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(200, RATE_BODY, { "retry-after": "3600" }));

    const error = await provider()
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error.reason).toBe("RATE_LIMITED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-429 rejection", async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(400, { error: { code: 400, message: "bad schema" } }));

    const error = await provider()
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error.reason).toBe("PROVIDER_REJECTED");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks the upstream provider name or raw payload in the thrown error", async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "0" }))
      .mockResolvedValueOnce(fakeResponse(429, RATE_BODY, { "retry-after": "0" }));

    const error: AiProviderError = await provider()
      .generateStructured(REQUEST)
      .catch((caught) => caught);

    expect(error.message).not.toContain("UpstreamVendorName");
    expect(error.message).not.toContain("UPSTREAM_RAW_DETAIL_do_not_leak");
    expect(error.message).not.toContain("Provider returned error");
    expect(error.message).toMatch(/rate-limited \(status 429\)/i);
  });
});
