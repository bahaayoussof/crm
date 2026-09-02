import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

// Mock the Resend SDK at the module boundary so the timeout seam in
// `sendTicketEmail` is exercised against a controllable `emails.send`.
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: mocks.send } })),
}));

import { sendTicketEmail, EMAIL_DELIVERY_TIMEOUT_MS } from "./email.client.js";

const baseParams = {
  apiKey: "re_test",
  from: "CRM Support <onboarding@resend.dev>",
  to: "customer@example.net",
  subject: "[CRM-ABCDEF12] Need help",
  html: "<p>On it</p>",
  text: "On it",
  replyTo: null,
  inReplyTo: null,
  references: [] as string[],
  idempotencyKey: "crm-ticket-message-message-1",
};

describe("sendTicketEmail outbound timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to the shared 20s bound", () => {
    expect(EMAIL_DELIVERY_TIMEOUT_MS).toBe(20_000);
  });

  it("forwards an AbortSignal to Resend so the request is really cancellable", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "email-out-1" }, error: null });
    await sendTicketEmail(baseParams);
    const options = mocks.send.mock.calls[0]![1] as { signal?: AbortSignal; idempotencyKey?: string };
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.idempotencyKey).toBe("crm-ticket-message-message-1");
  });

  it("throws ResendEmailError('timeout') when the request aborts (SDK throws)", async () => {
    // Deterministic: an already-aborted signal, no fake timers, no real wait.
    const signal = AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
    mocks.send.mockImplementationOnce((_payload, options: { signal: AbortSignal }) =>
      Promise.reject(options.signal.reason),
    );
    await expect(sendTicketEmail({ ...baseParams, signal })).rejects.toMatchObject({
      name: "ResendEmailError",
      operation: "timeout",
    });
  });

  it("throws ResendEmailError('timeout') when the aborted request is swallowed into result.error", async () => {
    const signal = AbortSignal.abort(new DOMException("timed out", "TimeoutError"));
    // Mirrors the SDK's fetchRequest catch: an aborted fetch returns a generic
    // error object (statusCode null) rather than throwing.
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { name: "application_error", statusCode: null, message: "Unable to fetch data. The request could not be resolved." },
    });
    await expect(sendTicketEmail({ ...baseParams, signal })).rejects.toMatchObject({
      name: "ResendEmailError",
      operation: "timeout",
    });
  });

  it("keeps a genuine provider rejection as operation 'send' (not a timeout)", async () => {
    mocks.send.mockResolvedValueOnce({
      data: null,
      error: { name: "validation_error", statusCode: 422, message: "Invalid `from` field" },
    });
    await expect(sendTicketEmail(baseParams)).rejects.toMatchObject({
      name: "ResendEmailError",
      operation: "send",
    });
  });

  it("returns the provider email id on a fast success", async () => {
    mocks.send.mockResolvedValueOnce({ data: { id: "email-out-9" }, error: null });
    await expect(sendTicketEmail(baseParams)).resolves.toEqual({ emailId: "email-out-9" });
  });
});
