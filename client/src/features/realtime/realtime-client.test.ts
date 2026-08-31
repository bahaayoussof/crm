import { describe, expect, it, vi } from "vitest";
import { parseRealtimeEvent } from "./realtime.types";
import { createRealtimeClient } from "./realtime-client";

describe("parseRealtimeEvent", () => {
  it("accepts each valid event shape", () => {
    expect(
      parseRealtimeEvent({ type: "ticket.message.created", ticketId: "t1", messageId: "m1", visibility: "public" }),
    ).toEqual({ type: "ticket.message.created", ticketId: "t1", messageId: "m1", visibility: "public" });
    expect(parseRealtimeEvent({ type: "ticket.updated", ticketId: "t1" })).toEqual({ type: "ticket.updated", ticketId: "t1" });
    expect(parseRealtimeEvent({ type: "notification.created", notificationId: null })).toEqual({
      type: "notification.created",
      notificationId: null,
    });
    expect(parseRealtimeEvent({ type: "notification.read", notificationId: "n1" })).toEqual({
      type: "notification.read",
      notificationId: "n1",
    });
  });

  it("rejects malformed / unknown events", () => {
    expect(parseRealtimeEvent(null)).toBeNull();
    expect(parseRealtimeEvent({ type: "ticket.updated" })).toBeNull();
    expect(parseRealtimeEvent({ type: "something.else", ticketId: "t1" })).toBeNull();
    expect(parseRealtimeEvent("nope")).toBeNull();
  });
});

function sseResponse(frames: string[], init: { status?: number } = {}) {
  const status = init.status ?? 200;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
  return { ok: status >= 200 && status < 300, status, body } as unknown as Response;
}
const pending = () => new Promise<Response>(() => {});
const frame = (event: unknown) => `id: 1\nevent: crm-event\ndata: ${JSON.stringify(event)}\n\n`;

describe("createRealtimeClient", () => {
  it("parses a streamed crm-event and forwards it to onEvent", async () => {
    const onEvent = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([": connected\n\n", frame({ type: "ticket.updated", ticketId: "t1" })]))
      .mockImplementation(pending);
    const client = createRealtimeClient({ url: "/x", getToken: () => "tok", onEvent, fetchImpl });
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith({ type: "ticket.updated", ticketId: "t1" }));
    client.close();
  });

  it("sends the JWT as an Authorization header, never in the URL", async () => {
    const fetchImpl = vi.fn().mockImplementation(pending);
    const client = createRealtimeClient({ url: "/realtime/events", getToken: () => "secret-jwt", onEvent: vi.fn(), fetchImpl });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    const [url, opts] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/realtime/events");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: "Bearer secret-jwt" });
    client.close();
  });

  it("ignores malformed event payloads without crashing", async () => {
    const onEvent = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse(["event: crm-event\ndata: {not json}\n\n", frame({ type: "ticket.updated", ticketId: "ok" })]),
      )
      .mockImplementation(pending);
    const client = createRealtimeClient({ url: "/x", getToken: () => "tok", onEvent, fetchImpl });
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));
    expect(onEvent).toHaveBeenCalledWith({ type: "ticket.updated", ticketId: "ok" });
    client.close();
  });

  it("stops (no reconnect) when the server rejects auth with 401", async () => {
    const statuses: string[] = [];
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([], { status: 401 }));
    const client = createRealtimeClient({
      url: "/x",
      getToken: () => "tok",
      onEvent: vi.fn(),
      onStatusChange: (s) => statuses.push(s),
      fetchImpl,
    });
    await vi.waitFor(() => expect(statuses).toContain("closed"));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("reconnects after a dropped stream", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(sseResponse([": connected\n\n"]))
      .mockImplementation(pending);
    const client = createRealtimeClient({ url: "/x", getToken: () => "tok", onEvent: vi.fn(), fetchImpl });
    await vi.waitFor(() => expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    client.close();
  });

  it("close() halts further reconnection", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse([": connected\n\n"]));
    const client = createRealtimeClient({ url: "/x", getToken: () => "tok", onEvent: vi.fn(), fetchImpl });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    client.close();
    const countAfterClose = fetchImpl.mock.calls.length;
    await new Promise((r) => setTimeout(r, 1500));
    expect(fetchImpl.mock.calls.length).toBe(countAfterClose);
  });

  it("does not connect when there is no token", async () => {
    const statuses: string[] = [];
    const fetchImpl = vi.fn();
    const client = createRealtimeClient({
      url: "/x",
      getToken: () => null,
      onEvent: vi.fn(),
      onStatusChange: (s) => statuses.push(s),
      fetchImpl,
    });
    await vi.waitFor(() => expect(statuses).toContain("closed"));
    expect(fetchImpl).not.toHaveBeenCalled();
    client.close();
  });
});
