import { parseRealtimeEvent, type RealtimeConnectionStatus, type RealtimeEvent } from "./realtime.types";

export interface RealtimeClientOptions {
  /** Absolute URL of the SSE endpoint, e.g. `${API_URL}/realtime/events`. */
  url: string;
  /** Returns the current JWT, or null when logged out. Called on every (re)connect. */
  getToken: () => string | null;
  onEvent: (event: RealtimeEvent) => void;
  onStatusChange?: (status: RealtimeConnectionStatus) => void;
  /** Test seam. */
  fetchImpl?: typeof fetch;
}

export interface RealtimeClient {
  close: () => void;
}

const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 15_000, 30_000];

function backoffDelay(attempt: number): number {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
  // Full jitter — avoid a reconnect stampede after a backend restart.
  return Math.round(base / 2 + Math.random() * (base / 2));
}

/**
 * One authenticated SSE stream with automatic, backed-off reconnection.
 *
 * Uses `fetch` + a `ReadableStream` reader rather than native `EventSource`
 * specifically so the existing `Authorization: Bearer <jwt>` header is sent —
 * no token in the URL, no cookie, no second auth path.
 *
 * A dropped/failed stream never throws to the caller: REST + TanStack Query keep
 * working with realtime unavailable. Reconnection resumes on its own.
 */
export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const doFetch = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  let closed = false;
  let attempt = 0;
  let controller: AbortController | null = null;
  let lastEventId: string | null = null;

  const setStatus = (status: RealtimeConnectionStatus) => options.onStatusChange?.(status);

  function dispatch(block: string) {
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue; // comment / heartbeat
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const rawValue = colon === -1 ? "" : line.slice(colon + 1);
      const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
      if (field === "event") eventName = value;
      else if (field === "data") dataLines.push(value);
      else if (field === "id") lastEventId = value;
    }
    if (eventName !== "crm-event" || dataLines.length === 0) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join("\n"));
    } catch {
      if (import.meta.env.DEV) console.warn("realtime: dropped malformed event payload");
      return;
    }
    const event = parseRealtimeEvent(parsed);
    if (event) options.onEvent(event);
    else if (import.meta.env.DEV) console.warn("realtime: dropped unrecognized event", parsed);
  }

  async function runOnce(): Promise<void> {
    const token = options.getToken();
    if (!token) throw new AuthGoneError();

    controller = new AbortController();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    };
    if (lastEventId) headers["Last-Event-ID"] = lastEventId;

    const response = await doFetch(options.url, { headers, signal: controller.signal, cache: "no-store" });
    if (response.status === 401 || response.status === 403) throw new AuthGoneError();
    if (!response.ok || !response.body) throw new Error(`realtime: unexpected response ${response.status}`);

    setStatus("open");
    attempt = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        dispatch(block);
      }
    }
  }

  async function loop() {
    while (!closed) {
      setStatus(attempt === 0 ? "connecting" : "reconnecting");
      try {
        await runOnce();
      } catch (error) {
        if (closed) break;
        if (error instanceof AuthGoneError) {
          // No valid token / rejected — stop. The provider recreates the client
          // when auth changes.
          setStatus("closed");
          return;
        }
        if (import.meta.env.DEV) console.warn("realtime: stream error, will reconnect", error);
      }
      if (closed) break;
      const delay = backoffDelay(attempt++);
      setStatus("reconnecting");
      await sleep(delay, () => closed);
    }
    setStatus("closed");
  }

  void loop();

  return {
    close() {
      closed = true;
      controller?.abort();
      setStatus("closed");
    },
  };
}

class AuthGoneError extends Error {}

function sleep(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    // Resolve early on close so shutdown is snappy.
    const check = setInterval(() => {
      if (cancelled()) {
        clearTimeout(id);
        clearInterval(check);
        resolve();
      }
    }, 200);
    setTimeout(() => clearInterval(check), ms + 50);
  });
}
