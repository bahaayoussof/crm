import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  historyCreate: vi.fn(),
  messageUpdate: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    ticketHistory: { create: mocks.historyCreate },
    ticketMessage: { update: mocks.messageUpdate },
  },
}));

import { AppError } from "../../shared/errors/app-error.js";
import {
  outboundFailureReason,
  recordOutboundDeliveryFailure,
} from "./outbound-delivery.js";
import { deliverOutboundSmsReply } from "./sms/sms.service.js";
import { setSmsProviderForTests } from "./sms/sms.provider.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.historyCreate.mockResolvedValue({});
  mocks.messageUpdate.mockResolvedValue({});
  setSmsProviderForTests(null);
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

  it("delivers after commit and stamps the TextBee batch id on the persisted row", async () => {
    setSmsProviderForTests({ sendMessage: vi.fn().mockResolvedValue({ externalId: "batch-1" }) });
    const result = await deliverOutboundSmsReply(base);
    expect(result).toEqual({ channel: "SMS", status: "SENT", externalId: "batch-1" });
    expect(mocks.messageUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: { externalId: "batch-1" } });
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
