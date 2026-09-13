import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  historyCreate: vi.fn(),
  messageUpdate: vi.fn(),
  deliveryCreate: vi.fn(),
  deliveryFindUnique: vi.fn(),
  deliveryUpdate: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  emitTicketUpdated: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ticketHistory: { create: mocks.historyCreate },
    ticketMessage: { update: mocks.messageUpdate },
    messageDelivery: {
      create: mocks.deliveryCreate,
      findUnique: mocks.deliveryFindUnique,
      update: mocks.deliveryUpdate,
      updateMany: mocks.deliveryUpdateMany,
    },
  },
}));

vi.mock("../realtime/realtime.publisher.js", () => ({ emitTicketUpdated: mocks.emitTicketUpdated }));

import { AppError } from "../../shared/errors/app-error.js";
import {
  outboundFailureReason,
  recordOutboundDeliveryFailure,
  createPendingDelivery,
  claimDeliveryForAttempt,
  recordDeliveryOutcome,
  recordDeliveryCallback,
  applyDeliveryCallback,
  OUTBOUND_MAX_ATTEMPTS,
} from "./outbound-delivery.js";
import { deliverOutboundSmsReply } from "./sms/sms.service.js";
import { setSmsProviderForTests } from "./sms/sms.provider.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.historyCreate.mockResolvedValue({});
  mocks.messageUpdate.mockResolvedValue({});
  mocks.deliveryCreate.mockResolvedValue({});
  mocks.deliveryFindUnique.mockResolvedValue(null);
  mocks.deliveryUpdate.mockResolvedValue({});
  mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });
  setSmsProviderForTests(null);
});

describe("CONV-040 — applyDeliveryCallback (callback + realtime emission)", () => {
  it("emits exactly one ticket.updated on a genuine state change", async () => {
    mocks.deliveryFindUnique
      .mockResolvedValueOnce({ id: "d1", status: "SENT", sentAt: new Date() })
      .mockResolvedValueOnce({ message: { ticket: { id: "t1", teamId: "team-1", assignedAgentId: "agent-1", customer: { id: "c1" } } } });
    const result = await applyDeliveryCallback("EMAIL", "resend:e1", { status: "DELIVERED" });
    expect(result).toEqual({ applied: true });
    expect(mocks.emitTicketUpdated).toHaveBeenCalledTimes(1);
    expect(mocks.emitTicketUpdated).toHaveBeenCalledWith({ ticketId: "t1", assignedAgentId: "agent-1", customerId: "c1", teamId: "team-1" });
  });

  it("emits nothing for an unknown provider id", async () => {
    mocks.deliveryFindUnique.mockResolvedValueOnce(null);
    const result = await applyDeliveryCallback("EMAIL", "resend:unknown", { status: "DELIVERED" });
    expect(result).toEqual({ applied: false, reason: "UNKNOWN" });
    expect(mocks.emitTicketUpdated).not.toHaveBeenCalled();
  });

  it("emits nothing for a stale/duplicate terminal-state callback", async () => {
    mocks.deliveryFindUnique.mockResolvedValueOnce({ id: "d1", status: "DELIVERED" });
    const result = await applyDeliveryCallback("EMAIL", "resend:e1", { status: "SENT" });
    expect(result).toEqual({ applied: false, reason: "TERMINAL_NO_OP" });
    expect(mocks.emitTicketUpdated).not.toHaveBeenCalled();
    expect(mocks.deliveryUpdate).not.toHaveBeenCalled();
  });
});

describe("CONV-017 — durable delivery primitives", () => {
  it("createPendingDelivery creates a PENDING row with attemptCount 0", async () => {
    await createPendingDelivery("m1", "EMAIL");
    expect(mocks.deliveryCreate).toHaveBeenCalledWith({ data: { messageId: "m1", channel: "EMAIL", status: "PENDING", attemptCount: 0 } });
  });

  it("claimDeliveryForAttempt returns null when the row is already leased/terminal (updateMany count 0)", async () => {
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 0 });
    const result = await claimDeliveryForAttempt("m1");
    expect(result).toBeNull();
    expect(mocks.deliveryFindUnique).not.toHaveBeenCalled();
  });

  it("claimDeliveryForAttempt returns the row when the claim succeeds", async () => {
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryFindUnique.mockResolvedValue({ id: "d1", messageId: "m1" });
    const result = await claimDeliveryForAttempt("m1");
    expect(result).toEqual({ id: "d1", messageId: "m1" });
  });

  it("recordDeliveryOutcome increments attemptCount by exactly 1 per call", async () => {
    mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 1, firstAttemptedAt: new Date(), providerMessageId: null });
    await recordDeliveryOutcome("m1", { status: "SENT", providerMessageId: "ext-1" });
    expect(mocks.deliveryUpdate.mock.calls[0][0].data.attemptCount).toBe(2);
  });

  it("recordDeliveryOutcome marks terminal FAILED after OUTBOUND_MAX_ATTEMPTS", async () => {
    mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: OUTBOUND_MAX_ATTEMPTS - 1, firstAttemptedAt: new Date() });
    await recordDeliveryOutcome("m1", { status: "FAILED", errorCode: "X" });
    const data = mocks.deliveryUpdate.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.nextAttemptAt).toBeNull();
  });

  it("recordDeliveryOutcome schedules a retry (not terminal) before the attempt cap", async () => {
    mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 0, firstAttemptedAt: null });
    await recordDeliveryOutcome("m1", { status: "FAILED", errorCode: "X" });
    const data = mocks.deliveryUpdate.mock.calls[0][0].data;
    expect(data.status).toBe("PENDING");
    expect(data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it("CONV-055: schedules exactly 1m after attempt 1 and 5m after attempt 2 (deterministic, not a random/backoff curve)", async () => {
    const now = new Date("2026-09-13T00:00:00.000Z");
    vi.useFakeTimers().setSystemTime(now);
    try {
      mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 0, firstAttemptedAt: null });
      await recordDeliveryOutcome("m1", { status: "FAILED", errorCode: "X" });
      expect(mocks.deliveryUpdate.mock.calls[0][0].data.nextAttemptAt).toEqual(new Date(now.getTime() + 60_000));

      mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 1, firstAttemptedAt: now });
      await recordDeliveryOutcome("m1", { status: "FAILED", errorCode: "X" });
      expect(mocks.deliveryUpdate.mock.calls[1][0].data.nextAttemptAt).toEqual(new Date(now.getTime() + 5 * 60_000));

      mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 2, firstAttemptedAt: now });
      await recordDeliveryOutcome("m1", { status: "FAILED", errorCode: "X" });
      const third = mocks.deliveryUpdate.mock.calls[2][0].data;
      expect(third.status).toBe("FAILED");
      expect(third.nextAttemptAt).toBeNull();
      expect(third.attemptCount).toBe(OUTBOUND_MAX_ATTEMPTS);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recordDeliveryCallback rejects a stale SENT-after-DELIVERED transition as a no-op, not an error", async () => {
    mocks.deliveryFindUnique.mockResolvedValue({ id: "d1", status: "DELIVERED" });
    const result = await recordDeliveryCallback("EMAIL", "ext-1", { status: "SENT" });
    expect(result).toEqual({ applied: false, reason: "TERMINAL_NO_OP" });
    expect(mocks.deliveryUpdate).not.toHaveBeenCalled();
  });

  it("recordDeliveryCallback applies a genuine SENT -> DELIVERED transition", async () => {
    mocks.deliveryFindUnique.mockResolvedValue({ id: "d1", status: "SENT", sentAt: new Date() });
    const result = await recordDeliveryCallback("EMAIL", "ext-1", { status: "DELIVERED" });
    expect(result).toEqual({ applied: true });
    expect(mocks.deliveryUpdate).toHaveBeenCalledTimes(1);
  });

  it("recordDeliveryCallback returns UNKNOWN for an unmatched provider id, no write", async () => {
    mocks.deliveryFindUnique.mockResolvedValue(null);
    const result = await recordDeliveryCallback("EMAIL", "no-such-id", { status: "DELIVERED" });
    expect(result).toEqual({ applied: false, reason: "UNKNOWN" });
    expect(mocks.deliveryUpdate).not.toHaveBeenCalled();
  });
});

describe("outboundFailureReason", () => {
  it("maps missing-configuration AppErrors to INTEGRATION_NOT_CONFIGURED", () => {
    expect(outboundFailureReason(new AppError(503, "EMAIL_NOT_CONFIGURED", "x"))).toBe("INTEGRATION_NOT_CONFIGURED");
    expect(outboundFailureReason(new AppError(503, "EMAIL_SENDER_INVALID", "x"))).toBe("INTEGRATION_NOT_CONFIGURED");
    expect(outboundFailureReason(new AppError(503, "SMS_NOT_CONFIGURED", "x"))).toBe("INTEGRATION_NOT_CONFIGURED");
  });

  it("maps recipient and provider AppErrors to their categories", () => {
    expect(outboundFailureReason(new AppError(422, "EMAIL_RECIPIENT_INVALID", "x"))).toBe("RECIPIENT_INVALID");
    expect(outboundFailureReason(new AppError(422, "CUSTOMER_PHONE_REQUIRED", "x"))).toBe("NO_RECIPIENT_PHONE");
    expect(outboundFailureReason(new AppError(502, "EMAIL_DELIVERY_FAILED", "x"))).toBe("PROVIDER_REJECTED");
    expect(outboundFailureReason(new AppError(502, "SMS_DELIVERY_FAILED", "x"))).toBe("PROVIDER_REJECTED");
  });

  it("maps timeout / never-connected provider AppErrors to PROVIDER_UNREACHABLE", () => {
    expect(outboundFailureReason(new AppError(504, "EMAIL_DELIVERY_TIMEOUT", "x"))).toBe("PROVIDER_UNREACHABLE");
    expect(outboundFailureReason(new AppError(504, "SMS_DELIVERY_UNREACHABLE", "x"))).toBe("PROVIDER_UNREACHABLE");
  });

  it("falls back to PROVIDER_UNREACHABLE for raw/unknown errors", () => {
    expect(outboundFailureReason(new Error("socket hang up"))).toBe("PROVIDER_UNREACHABLE");
    expect(outboundFailureReason(new AppError(500, "SOMETHING_ELSE", "x"))).toBe("PROVIDER_UNREACHABLE");
    expect(outboundFailureReason(undefined)).toBe("PROVIDER_UNREACHABLE");
  });
});

describe("recordOutboundDeliveryFailure", () => {
  it("writes a channel-prefixed *_DELIVERY_FAILED history row and returns the FAILED result", async () => {
    const result = await recordOutboundDeliveryFailure({ channel: "SMS", ticketId: "t1", reason: "INTEGRATION_NOT_CONFIGURED" });
    expect(result).toEqual({ channel: "SMS", status: "FAILED", reason: "INTEGRATION_NOT_CONFIGURED" });
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: { ticketId: "t1", actorUserId: null, action: "SMS_DELIVERY_FAILED", newValue: "INTEGRATION_NOT_CONFIGURED" },
    });
  });

  it("never throws when the history write fails — the committed reply must survive", async () => {
    mocks.historyCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordOutboundDeliveryFailure({ channel: "EMAIL", ticketId: "t1", reason: "PROVIDER_UNREACHABLE" }),
    ).resolves.toMatchObject({ channel: "EMAIL", status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
  });
});

describe("deliverOutboundSmsReply", () => {
  const base = { ticketId: "t1", messageId: "m1", to: "+14155552671", text: "hi" };

  beforeEach(() => {
    // These tests exercise the actual send attempt, so the claim must win.
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 0, firstAttemptedAt: null, providerMessageId: null });
  });

  it("delivers after commit and records the TextBee batch id on the durable delivery row (CONV-037 — not TicketMessage.externalId)", async () => {
    setSmsProviderForTests({ sendMessage: vi.fn().mockResolvedValue({ externalId: "batch-1" }) });
    const result = await deliverOutboundSmsReply(base);
    expect(result).toEqual({ channel: "SMS", status: "SENT", externalId: "batch-1" });
    expect(mocks.messageUpdate).not.toHaveBeenCalled();
    expect(mocks.deliveryUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SENT", providerMessageId: "batch-1" }),
    }));
    expect(mocks.historyCreate).not.toHaveBeenCalled();
  });

  it("records SMS_DELIVERY_FAILED and returns FAILED when the provider is unconfigured (no throw)", async () => {
    setSmsProviderForTests({ sendMessage: vi.fn().mockRejectedValue(new AppError(503, "SMS_NOT_CONFIGURED", "x")) });
    const result = await deliverOutboundSmsReply(base);
    expect(result).toMatchObject({ channel: "SMS", status: "FAILED", reason: "INTEGRATION_NOT_CONFIGURED" });
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: { ticketId: "t1", actorUserId: null, action: "SMS_DELIVERY_FAILED", newValue: "INTEGRATION_NOT_CONFIGURED" },
    });
    expect(mocks.messageUpdate).not.toHaveBeenCalled();
  });

  it("records SMS_DELIVERY_FAILED when TextBee rejects at runtime", async () => {
    setSmsProviderForTests({ sendMessage: vi.fn().mockRejectedValue(new AppError(502, "SMS_DELIVERY_FAILED", "rejected")) });
    const result = await deliverOutboundSmsReply(base);
    expect(result).toMatchObject({ channel: "SMS", status: "FAILED", reason: "PROVIDER_REJECTED" });
  });

  it("records a single SMS_DELIVERY_FAILED/PROVIDER_UNREACHABLE row when the send times out (no throw, no id stamp)", async () => {
    setSmsProviderForTests({ sendMessage: vi.fn().mockRejectedValue(new AppError(504, "SMS_DELIVERY_UNREACHABLE", "timeout")) });
    const result = await deliverOutboundSmsReply(base);
    expect(result).toMatchObject({ channel: "SMS", status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
    expect(mocks.historyCreate).toHaveBeenCalledTimes(1);
    expect(mocks.historyCreate).toHaveBeenCalledWith({
      data: { ticketId: "t1", actorUserId: null, action: "SMS_DELIVERY_FAILED", newValue: "PROVIDER_UNREACHABLE" },
    });
    expect(mocks.messageUpdate).not.toHaveBeenCalled();
  });

  it("returns FAILED NO_RECIPIENT_PHONE without calling the provider when the customer has no phone", async () => {
    const sendMessage = vi.fn();
    setSmsProviderForTests({ sendMessage });
    const result = await deliverOutboundSmsReply({ ...base, to: null });
    expect(result).toMatchObject({ channel: "SMS", status: "FAILED", reason: "NO_RECIPIENT_PHONE" });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
