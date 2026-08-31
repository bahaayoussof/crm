import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleRealtimeEvent } from "./realtime-event-handler";

// ---------------------------------------------------------------------------
// query invalidation mapping
// ---------------------------------------------------------------------------
describe("handleRealtimeEvent", () => {
  const setup = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spy = vi.spyOn(client, "invalidateQueries");
    return { client, spy };
  };
  const keys = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.map(([arg]) => JSON.stringify((arg as { queryKey: unknown[] }).queryKey));

  it("ticket.message.created invalidates that ticket's detail and the ticket lists only", () => {
    const { client, spy } = setup();
    handleRealtimeEvent(client, { type: "ticket.message.created", ticketId: "t7", messageId: "m1", visibility: "public" });
    expect(keys(spy)).toEqual([JSON.stringify(["tickets", "detail", "t7"]), JSON.stringify(["tickets", "list"])]);
  });

  it("ticket.updated also refreshes the dashboard", () => {
    const { client, spy } = setup();
    handleRealtimeEvent(client, { type: "ticket.updated", ticketId: "t7" });
    expect(keys(spy)).toEqual([
      JSON.stringify(["tickets", "detail", "t7"]),
      JSON.stringify(["tickets", "list"]),
      JSON.stringify(["dashboard"]),
    ]);
  });

  it("notification.created invalidates the notification list and unread count", () => {
    const { client, spy } = setup();
    handleRealtimeEvent(client, { type: "notification.created", notificationId: null });
    expect(keys(spy)).toEqual([JSON.stringify(["notifications", "list"]), JSON.stringify(["notifications", "unread-count"])]);
  });

  it("notification.read maps to the same notification invalidations", () => {
    const { client, spy } = setup();
    handleRealtimeEvent(client, { type: "notification.read", notificationId: "n1" });
    expect(keys(spy)).toEqual([JSON.stringify(["notifications", "list"]), JSON.stringify(["notifications", "unread-count"])]);
  });

  it("an unrelated ticket event never invalidates notifications", () => {
    const { client, spy } = setup();
    handleRealtimeEvent(client, { type: "ticket.updated", ticketId: "t7" });
    expect(keys(spy).some((k) => k.includes("notifications"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// provider — one connection, lifecycle
// ---------------------------------------------------------------------------
const closeSpy = vi.fn();
const createClientSpy = vi.fn((_opts?: unknown) => ({ close: closeSpy }));
vi.mock("./realtime-client", () => ({ createRealtimeClient: (opts: unknown) => createClientSpy(opts) }));

let mockUser: { id: string; role: string } | null = null;
vi.mock("@/features/auth/auth-state", () => ({
  useAuth: () => ({ user: mockUser }),
  AUTH_QUERY_KEY: ["auth", "me"],
}));
vi.mock("@/features/auth/auth-token", () => ({ getAuthToken: () => "tok" }));

import { RealtimeProvider } from "./realtime-provider";

const renderProvider = () => {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <RealtimeProvider>
        <div>child</div>
      </RealtimeProvider>
    </QueryClientProvider>,
  );
};

describe("RealtimeProvider", () => {
  beforeEach(() => {
    mockUser = null;
    createClientSpy.mockClear();
    createClientSpy.mockImplementation(() => ({ close: closeSpy }));
    closeSpy.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("opens exactly one connection for an authenticated internal user", () => {
    mockUser = { id: "u1", role: "AGENT" };
    renderProvider();
    expect(createClientSpy).toHaveBeenCalledTimes(1);
  });

  it("does not connect for a CUSTOMER (portal) session", () => {
    mockUser = { id: "c1", role: "CUSTOMER" };
    renderProvider();
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it("does not connect when logged out", () => {
    mockUser = null;
    renderProvider();
    expect(createClientSpy).not.toHaveBeenCalled();
  });

  it("closes the connection on unmount (logout / route change)", () => {
    mockUser = { id: "u1", role: "MANAGER" };
    const { unmount } = renderProvider();
    unmount();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("never crashes the tree when the connection fails to open", () => {
    createClientSpy.mockImplementationOnce(() => {
      throw new Error("connect failed");
    });
    mockUser = { id: "u1", role: "ADMIN" };
    expect(() => renderProvider()).not.toThrow();
  });
});
