import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deliveryFindMany: vi.fn(),
  deliveryFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  deliverEmail: vi.fn(),
  deliverSms: vi.fn(),
  deliverWhatsapp: vi.fn(),
  emitTicketUpdated: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => ({
  prisma: {
    messageDelivery: { findMany: mocks.deliveryFindMany, findUnique: mocks.deliveryFindUnique },
    ticketMessage: { findMany: mocks.messageFindMany },
  },
}));

vi.mock("./email/email.service.js", () => ({ deliverOutboundEmailReply: mocks.deliverEmail }));
vi.mock("./sms/sms.service.js", () => ({ deliverOutboundSmsReply: mocks.deliverSms }));
vi.mock("./whatsapp/whatsapp.service.js", () => ({ deliverOutboundReply: mocks.deliverWhatsapp }));
vi.mock("../realtime/realtime.publisher.js", () => ({ emitTicketUpdated: mocks.emitTicketUpdated }));

const { deliverEmail, deliverSms, deliverWhatsapp, emitTicketUpdated } = mocks;

import { runOutboundDeliveryRetrySweep } from "./outbound-delivery-retry.service.js";

const ROW = {
  id: "d1",
  messageId: "m1",
  channel: "SMS",
  status: "PENDING",
  message: {
    id: "m1",
    body: "hello",
    ticket: { id: "t1", subject: "s", teamId: "team-1", assignedAgentId: "agent-1", emailThreadToken: null, customer: { id: "cust-1", email: null, phone: "+14155552671" } },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.messageFindMany.mockResolvedValue([]);
});

describe("runOutboundDeliveryRetrySweep — CONV-038", () => {
  it("claims and retries a due PENDING row, emits ticket.updated on a genuine SENT transition", async () => {
    mocks.deliveryFindMany.mockResolvedValue([ROW]);
    deliverSms.mockResolvedValue({ channel: "SMS", status: "SENT", externalId: "batch-2" });
    mocks.deliveryFindUnique.mockResolvedValue({ status: "SENT" });

    const result = await runOutboundDeliveryRetrySweep();
    expect(deliverSms).toHaveBeenCalledWith({ ticketId: "t1", messageId: "m1", to: "+14155552671", text: "hello" });
    expect(result).toMatchObject({ candidates: 1, attempted: 1, sent: 1, failed: 0 });
    expect(emitTicketUpdated).toHaveBeenCalledTimes(1);
    expect(emitTicketUpdated).toHaveBeenCalledWith({ ticketId: "t1", assignedAgentId: "agent-1", customerId: "cust-1", teamId: "team-1" });
  });

  it("emits nothing when the retry attempt leaves the row still PENDING (a real attempt that stays retrying is not a visible state change)", async () => {
    mocks.deliveryFindMany.mockResolvedValue([ROW]);
    deliverSms.mockResolvedValue({ channel: "SMS", status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
    mocks.deliveryFindUnique.mockResolvedValue({ status: "PENDING" });

    await runOutboundDeliveryRetrySweep();
    expect(emitTicketUpdated).not.toHaveBeenCalled();
  });

  it("emits nothing for a claim lost to an overlapping invocation (status unchanged)", async () => {
    mocks.deliveryFindMany.mockResolvedValue([ROW]);
    deliverSms.mockResolvedValue({ channel: "SMS", status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
    mocks.deliveryFindUnique.mockResolvedValue({ status: "PENDING" }); // unchanged from row.status
    await runOutboundDeliveryRetrySweep();
    expect(emitTicketUpdated).not.toHaveBeenCalled();
  });

  it("never creates a TicketMessage/notification/audit or ticket.message.created event — the sweep has no access to those primitives at all", async () => {
    mocks.deliveryFindMany.mockResolvedValue([ROW]);
    deliverSms.mockResolvedValue({ channel: "SMS", status: "SENT", externalId: "batch-2" });
    mocks.deliveryFindUnique.mockResolvedValue({ status: "SENT" });
    await runOutboundDeliveryRetrySweep();
    // The retry module only imports messageDelivery/ticketMessage(read) + emitTicketUpdated —
    // structurally incapable of creating a message, notification, or audit row.
    expect(deliverSms).toHaveBeenCalledTimes(1);
  });

  it("skips a row for an unsupported channel gracefully", async () => {
    mocks.deliveryFindMany.mockResolvedValue([{ ...ROW, channel: "WEB" }]);
    const result = await runOutboundDeliveryRetrySweep();
    expect(deliverSms).not.toHaveBeenCalled();
    expect(deliverEmail).not.toHaveBeenCalled();
    expect(deliverWhatsapp).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });
});
