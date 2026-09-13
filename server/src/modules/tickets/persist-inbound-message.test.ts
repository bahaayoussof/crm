import { describe, expect, it, vi } from "vitest";
import { Prisma, TicketStatus } from "@prisma/client";
import { persistInboundMessage, isInboundKeyConflict } from "./persist-inbound-message.js";

vi.mock("../../shared/team/team-scope.js", () => ({ customerReplyNotificationRecipientIds: vi.fn().mockResolvedValue([]) }));
vi.mock("../notifications/notification.service.js", () => ({ createNotifications: vi.fn() }));

const TICKET = { id: "t1", status: TicketStatus.OPEN, assignedAgentId: null, teamId: null, subject: "s", customerId: "c1" };

function makeTx(createImpl: () => Promise<{ id: string }>) {
  return {
    ticketMessage: { create: vi.fn(createImpl) },
    ticket: { update: vi.fn() },
    ticketHistory: { create: vi.fn() },
  } as never;
}

describe("isInboundKeyConflict", () => {
  it("returns true only when the violated constraint targets TicketMessage.inboundKey", () => {
    const inboundKeyError = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["TicketMessage_inboundKey_key"] } });
    expect(isInboundKeyConflict(inboundKeyError)).toBe(true);

    const otherError = new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["Customer_email_key"] } });
    expect(isInboundKeyConflict(otherError)).toBe(false);

    expect(isInboundKeyConflict(new Error("plain"))).toBe(false);
  });
});

describe("persistInboundMessage — CONV-016", () => {
  it("returns DUPLICATE with no side effects on an inboundKey P2002, without touching ticket status", async () => {
    const tx = makeTx(async () => {
      throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["TicketMessage_inboundKey_key"] } });
    });
    const result = await persistInboundMessage(tx, {
      ticket: TICKET, authorUserId: "sys-1", body: "hi", inboundKey: "sms:1", contentFormat: "PLAIN_TEXT", contentSource: "SMS", createdAt: new Date(),
    });
    expect(result).toEqual({ status: "DUPLICATE" });
    expect((tx as ReturnType<typeof makeTx>).ticket.update).not.toHaveBeenCalled();
  });

  it("propagates a P2002 on an unrelated constraint (e.g. placeholder-email collision) instead of misclassifying as DUPLICATE", async () => {
    const tx = makeTx(async () => {
      throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["Customer_email_key"] } });
    });
    await expect(
      persistInboundMessage(tx, { ticket: TICKET, authorUserId: "sys-1", body: "hi", inboundKey: "sms:1", contentFormat: "PLAIN_TEXT", contentSource: "SMS", createdAt: new Date() }),
    ).rejects.toThrow();
  });

  it("transitions WAITING_CUSTOMER -> IN_PROGRESS and returns the audience payload on success", async () => {
    const tx = makeTx(async () => ({ id: "m1" }));
    const result = await persistInboundMessage(tx, {
      ticket: { ...TICKET, status: TicketStatus.WAITING_CUSTOMER, teamId: "team-1", assignedAgentId: "agent-1" },
      authorUserId: "sys-1", body: "hi", inboundKey: "sms:2", contentFormat: "PLAIN_TEXT", contentSource: "SMS", createdAt: new Date(),
    });
    expect(result).toEqual({ status: "CREATED", messageId: "m1", assignedAgentId: "agent-1", customerId: "c1", teamId: "team-1" });
    expect((tx as ReturnType<typeof makeTx>).ticket.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: TicketStatus.IN_PROGRESS } });
  });

  it("does not transition status for a non-WAITING_CUSTOMER ticket", async () => {
    const tx = makeTx(async () => ({ id: "m1" }));
    await persistInboundMessage(tx, { ticket: TICKET, authorUserId: "sys-1", body: "hi", inboundKey: "sms:3", contentFormat: "PLAIN_TEXT", contentSource: "SMS", createdAt: new Date() });
    expect((tx as ReturnType<typeof makeTx>).ticket.update).not.toHaveBeenCalled();
  });

  // CONV-054 — this transaction helper is the shared seam every provider
  // inbound path (Email/SMS/WhatsApp) funnels through; the WAITING_CUSTOMER ->
  // IN_PROGRESS transition and inboundKey-DUPLICATE classification are
  // channel-agnostic by construction (CONV-016), so one parameterized check
  // here proves the invariant holds identically for every provider channel.
  it.each(["EMAIL", "SMS", "WHATSAPP"] as const)(
    "%s: transitions WAITING_CUSTOMER -> IN_PROGRESS and classifies its own inboundKey conflict as DUPLICATE",
    async (channel) => {
      const ok = makeTx(async () => ({ id: `m-${channel}` }));
      const created = await persistInboundMessage(ok, {
        ticket: { ...TICKET, status: TicketStatus.WAITING_CUSTOMER },
        authorUserId: "sys-1", body: "hi", inboundKey: `${channel.toLowerCase()}:1`, contentFormat: "PLAIN_TEXT", contentSource: channel, createdAt: new Date(),
      });
      expect(created).toMatchObject({ status: "CREATED" });
      expect((ok as ReturnType<typeof makeTx>).ticket.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { status: TicketStatus.IN_PROGRESS } });

      const dup = makeTx(async () => {
        throw new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["TicketMessage_inboundKey_key"] } });
      });
      const result = await persistInboundMessage(dup, {
        ticket: TICKET, authorUserId: "sys-1", body: "hi", inboundKey: `${channel.toLowerCase()}:2`, contentFormat: "PLAIN_TEXT", contentSource: channel, createdAt: new Date(),
      });
      expect(result).toEqual({ status: "DUPLICATE" });
    },
  );
});
