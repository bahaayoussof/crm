import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), retrieve: vi.fn(), download: vi.fn(), send: vi.fn(),
  messageFindUnique: vi.fn(), messageFindFirst: vi.fn(), messageCreate: vi.fn(), messageUpdate: vi.fn(),
  userFindUnique: vi.fn(), userCreate: vi.fn(), userFindMany: vi.fn(),
  customerFindFirst: vi.fn(), customerCreate: vi.fn(),
  ticketFindFirst: vi.fn(), ticketFindMany: vi.fn(), ticketFindUnique: vi.fn(), ticketCreate: vi.fn(), ticketUpdate: vi.fn(),
  slaFindFirst: vi.fn(), historyCreate: vi.fn(), notificationCreateMany: vi.fn(), attachmentCreateMany: vi.fn(), watcherFindMany: vi.fn(),
  transaction: vi.fn(), storagePut: vi.fn(), storageRemove: vi.fn(),
}));

vi.mock("../../../config/prisma.js", () => {
  const client = {
    ticketMessage: { findUnique: mocks.messageFindUnique, findFirst: mocks.messageFindFirst, create: mocks.messageCreate, update: mocks.messageUpdate },
    user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, findMany: mocks.userFindMany },
    customer: { findFirst: mocks.customerFindFirst, create: mocks.customerCreate },
    ticket: { findFirst: mocks.ticketFindFirst, findMany: mocks.ticketFindMany, findUnique: mocks.ticketFindUnique, create: mocks.ticketCreate, update: mocks.ticketUpdate },
    slaRule: { findFirst: mocks.slaFindFirst },
    ticketHistory: { create: mocks.historyCreate },
    ticketWatcher: { findMany: mocks.watcherFindMany },
    notification: { createMany: mocks.notificationCreateMany },
    attachment: { createMany: mocks.attachmentCreateMany },
    $transaction: mocks.transaction,
  };
  return { prisma: client };
});

vi.mock("./email.client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./email.client.js")>();
  return {
    ...actual,
    emailClient: {
      verifyResendWebhook: mocks.verify,
      retrieveReceivedEmail: mocks.retrieve,
      downloadReceivedAttachment: mocks.download,
      sendTicketEmail: mocks.send,
    },
  };
});

vi.mock("./email.config.js", () => ({
  requireInboundEmailConfig: () => ({ apiKey: "re_test", webhookSecret: "whsec_test", inboundAddress: "support@inbound.resend.app" }),
  requireOutboundEmailConfig: () => ({ apiKey: "re_test", from: "CRM Support <onboarding@resend.dev>", inboundAddress: "support@inbound.resend.app" }),
}));

vi.mock("../../attachments/attachment-storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../attachments/attachment-storage.js")>();
  return {
    ...actual,
    getAttachmentStorage: vi.fn().mockResolvedValue({
      put: mocks.storagePut,
      remove: mocks.storageRemove,
      head: vi.fn(),
      get: vi.fn(),
    }),
  };
});

vi.mock("bcrypt", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed") } }));
vi.mock("../../realtime/realtime.publisher.js", () => ({
  withRealtimeOutbox: (fn: () => unknown) => fn(),
  emitTicketMessageCreated: vi.fn(),
  emitTicketUpdated: vi.fn(),
  emitNotificationCreated: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

import { app } from "../../../app.js";
import { emitTicketMessageCreated } from "../../realtime/realtime.publisher.js";
import { deliverOutboundEmailReply } from "./email.service.js";
import { ResendEmailError } from "./email.client.js";
const emitMessageMock = vi.mocked(emitTicketMessageCreated);

const webhookEvent = {
  type: "email.received",
  created_at: "2026-08-31T10:00:00.000Z",
  data: {
    email_id: "email-in-1",
    message_id: "<message-in-1@example.net>",
    from: "customer@example.net",
    to: ["support@inbound.resend.app"],
    subject: "Need help",
  },
};

const received = {
  id: "email-in-1",
  from: "customer@example.net",
  to: ["support@inbound.resend.app"],
  subject: "Need help",
  text: "Please help with my account",
  html: null,
  messageId: "<message-in-1@example.net>",
  headers: { from: "Customer Name <customer@example.net>" },
  createdAt: "2026-08-31T10:00:00.000Z",
  attachments: [],
};

const signed = (payload = webhookEvent) => request(app)
  .post("/api/integrations/email/webhook")
  .set("content-type", "application/json")
  .set("svix-id", "msg_1")
  .set("svix-timestamp", "1788170400")
  .set("svix-signature", "v1,test")
  .send(JSON.stringify(payload));

describe("Resend email integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockImplementation(({ payload }: { payload: string }) => JSON.parse(payload));
    mocks.retrieve.mockResolvedValue(received);
    mocks.messageFindUnique.mockResolvedValue(null);
    mocks.userFindUnique.mockResolvedValue({ id: "email-system" });
    mocks.userCreate.mockResolvedValue({ id: "email-system" });
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }]);
    mocks.customerFindFirst.mockResolvedValue(null);
    mocks.customerCreate.mockResolvedValue({ id: "customer-1" });
    mocks.messageFindFirst.mockResolvedValue(null);
    mocks.ticketFindFirst.mockResolvedValue(null);
    mocks.ticketFindMany.mockResolvedValue([]);
    mocks.ticketFindUnique.mockResolvedValue({ teamId: null });
    mocks.ticketCreate.mockResolvedValue({
      id: "ticket-1", status: "OPEN", subject: "Need help", assignedAgentId: null, emailThreadToken: "token-1",
    });
    mocks.ticketUpdate.mockResolvedValue({});
    mocks.slaFindFirst.mockResolvedValue(null);
    mocks.historyCreate.mockResolvedValue({});
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
    mocks.watcherFindMany.mockResolvedValue([]);
    mocks.messageCreate.mockResolvedValue({ id: "message-1" });
    mocks.messageUpdate.mockResolvedValue({ id: "message-1" });
    mocks.attachmentCreateMany.mockResolvedValue({ count: 1 });
    mocks.storagePut.mockResolvedValue(undefined);
    mocks.storageRemove.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      ticketMessage: { findUnique: mocks.messageFindUnique, findFirst: mocks.messageFindFirst, create: mocks.messageCreate },
      user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, findMany: mocks.userFindMany },
      customer: { findFirst: mocks.customerFindFirst, create: mocks.customerCreate },
      ticket: { findFirst: mocks.ticketFindFirst, findMany: mocks.ticketFindMany, findUnique: mocks.ticketFindUnique, create: mocks.ticketCreate, update: mocks.ticketUpdate },
      slaRule: { findFirst: mocks.slaFindFirst },
      ticketHistory: { create: mocks.historyCreate },
      ticketWatcher: { findMany: mocks.watcherFindMany },
      notification: { createMany: mocks.notificationCreateMany },
      attachment: { createMany: mocks.attachmentCreateMany },
    }));
  });

  it("rejects an invalid webhook signature before processing", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await signed();
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("ignores unsupported signed events safely", async () => {
    const response = await signed({ type: "email.delivered", created_at: "2026-08-31T10:00:00Z", data: {} } as typeof webhookEvent);
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("IGNORED");
    expect(mocks.retrieve).not.toHaveBeenCalled();
  });

  it("creates a customer, EMAIL ticket, customer message, history, and notification", async () => {
    const response = await signed();
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("TICKET_CREATED");
    expect(mocks.customerCreate).toHaveBeenCalledWith({ data: { name: "Customer Name", email: "customer@example.net" }, select: { id: true } });
    expect(mocks.ticketCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: "EMAIL", customerId: "customer-1" }) }));
    expect(mocks.messageCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      ticketId: "ticket-1", authorUserId: "email-system", externalId: "resend:email-in-1", externalMessageId: "<message-in-1@example.net>",
    }) }));
    expect(mocks.notificationCreateMany).toHaveBeenCalled();
    expect(emitMessageMock).toHaveBeenCalledWith(expect.objectContaining({ ticketId: "ticket-1", visibility: "public" }));
  });

  it("returns a successful no-op for a repeated provider email id", async () => {
    mocks.messageFindUnique.mockResolvedValue({ id: "existing-message" });
    const response = await signed();
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("DUPLICATE");
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.ticketCreate).not.toHaveBeenCalled();
    expect(emitMessageMock).not.toHaveBeenCalled();
  });

  it("does not emit ticket.message.created when the inbound transaction fails", async () => {
    mocks.messageCreate.mockRejectedValueOnce(new Error("db write failed"));
    const response = await signed();
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(emitMessageMock).not.toHaveBeenCalled();
  });

  it("correlates a known RFC reference only within the sender customer's EMAIL tickets", async () => {
    mocks.customerFindFirst.mockResolvedValue({ id: "customer-1" });
    mocks.retrieve.mockResolvedValue({ ...received, headers: { ...received.headers, "in-reply-to": "<prior@example.net>" } });
    mocks.messageFindFirst.mockResolvedValue({ ticket: { id: "ticket-existing", status: "OPEN", subject: "Existing", assignedAgentId: null, emailThreadToken: "token" } });
    const response = await signed();
    expect(response.body.data).toMatchObject({ status: "MESSAGE_APPENDED", ticketId: "ticket-existing" });
    expect(mocks.messageFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      externalMessageId: { in: ["<prior@example.net>"] },
      ticket: { customerId: "customer-1", channel: "EMAIL" },
    }) }));
    expect(mocks.ticketCreate).not.toHaveBeenCalled();
  });

  it("targets a reply to an assigned, team-routed ticket at the agent + team manager only (no global ADMIN fan-out)", async () => {
    mocks.customerFindFirst.mockResolvedValue({ id: "customer-1" });
    mocks.retrieve.mockResolvedValue({ ...received, headers: { ...received.headers, "in-reply-to": "<prior@example.net>" } });
    mocks.messageFindFirst.mockResolvedValue({ ticket: { id: "ticket-existing", status: "OPEN", subject: "Existing", assignedAgentId: "agent-a", emailThreadToken: "token" } });
    mocks.ticketFindUnique.mockResolvedValue({ teamId: "team-a" });
    mocks.watcherFindMany.mockResolvedValue([]);
    mocks.userFindMany.mockResolvedValue([{ id: "agent-a" }, { id: "mgr-a" }]);
    const response = await signed();
    expect(response.body.data).toMatchObject({ status: "MESSAGE_APPENDED" });
    // The shared resolver queries staff by an OR of the assignee + this team's
    // manager — never the unconditional `{ role: ADMIN }` clause.
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, OR: [{ id: "agent-a" }, { role: Role.MANAGER, managedTeam: { id: "team-a" } }] },
    }));
    expect(mocks.watcherFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ticketId: "ticket-existing" } }));
  });

  it("does not let a subject reference bypass sender/customer scoping", async () => {
    mocks.customerFindFirst.mockResolvedValue({ id: "customer-attacker" });
    mocks.retrieve.mockResolvedValue({ ...received, subject: "Re: [CRM-ABC12345] Privileged ticket" });
    await signed();
    expect(mocks.ticketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ customerId: "customer-attacker", channel: "EMAIL" }),
      take: 2,
    }));
  });

  it("reuses the customer-reply WAITING_CUSTOMER transition", async () => {
    mocks.customerFindFirst.mockResolvedValue({ id: "customer-1" });
    mocks.ticketFindMany.mockResolvedValueOnce([{ id: "ticket-waiting", status: "WAITING_CUSTOMER", subject: "Waiting", assignedAgentId: null, emailThreadToken: "token" }]);
    const response = await signed();
    expect(response.body.data.status).toBe("MESSAGE_APPENDED");
    expect(mocks.ticketUpdate).toHaveBeenCalledWith({ where: { id: "ticket-waiting" }, data: { status: "IN_PROGRESS" } });
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ oldValue: "WAITING_CUSTOMER", newValue: "IN_PROGRESS" }) });
  });

  it("stores a valid inbound attachment with provider idempotency metadata", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    mocks.retrieve.mockResolvedValue({
      ...received,
      attachments: [{ id: "att-1", filename: "../avatar.png", size: png.length, contentType: "application/octet-stream" }],
    });
    mocks.download.mockResolvedValue(png);
    const response = await signed();
    expect(response.status).toBe(200);
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringMatching(/^attachments\/email\//), png, { contentType: "image/png" });
    expect(mocks.attachmentCreateMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      messageId: expect.any(String), fileName: "avatar.png", mimeType: "image/png", externalId: "resend:email-in-1:att-1",
    })] });
  });

  it("skips unsupported inbound attachments without duplicating or rejecting the message", async () => {
    mocks.retrieve.mockResolvedValue({
      ...received,
      attachments: [{ id: "att-bad", filename: "payload.exe", size: 4, contentType: "application/octet-stream" }],
    });
    mocks.download.mockResolvedValue(Buffer.from([0x4d, 0x5a, 0x00, 0x00]));
    const response = await signed();
    expect(response.status).toBe(200);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.attachmentCreateMany).not.toHaveBeenCalled();
    expect(mocks.messageCreate).toHaveBeenCalledTimes(1);
  });
});

describe("outbound email reply resilience (deliverOutboundEmailReply)", () => {
  const params = {
    ticketId: "ticket-1",
    messageId: "message-1",
    recipient: "customer@example.net",
    subject: "Need help",
    body: "<p>On it</p>",
    threadToken: "token-1",
    inReplyTo: null,
    references: [] as string[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({ emailId: "email-out-1" });
    mocks.messageUpdate.mockResolvedValue({ id: "message-1" });
    mocks.historyCreate.mockResolvedValue({});
  });

  it("delivers after commit and stamps the provider id on the already-persisted row", async () => {
    const result = await deliverOutboundEmailReply(params);
    expect(result).toEqual({ channel: "EMAIL", status: "SENT", externalId: "resend:email-out-1" });
    expect(mocks.messageUpdate).toHaveBeenCalledWith({ where: { id: "message-1" }, data: { externalId: "resend:email-out-1" } });
    expect(mocks.historyCreate).not.toHaveBeenCalled();
  });

  it("returns FAILED and records EMAIL_DELIVERY_FAILED when Resend rejects (no throw, no rollback)", async () => {
    mocks.send.mockRejectedValueOnce(new Error("Resend 500"));
    const result = await deliverOutboundEmailReply(params);
    expect(result).toMatchObject({ channel: "EMAIL", status: "FAILED", reason: "PROVIDER_REJECTED" });
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: { ticketId: "ticket-1", actorUserId: null, action: "EMAIL_DELIVERY_FAILED", newValue: "PROVIDER_REJECTED" } });
    expect(mocks.messageUpdate).not.toHaveBeenCalled();
  });

  it("classifies an outbound Resend timeout as PROVIDER_UNREACHABLE (no throw, no rollback, one failure row)", async () => {
    mocks.send.mockRejectedValueOnce(new ResendEmailError("timeout", "Resend did not respond within the outbound email timeout"));
    const result = await deliverOutboundEmailReply(params);
    expect(result).toMatchObject({ channel: "EMAIL", status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
    expect(mocks.historyCreate).toHaveBeenCalledTimes(1);
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: { ticketId: "ticket-1", actorUserId: null, action: "EMAIL_DELIVERY_FAILED", newValue: "PROVIDER_UNREACHABLE" } });
    expect(mocks.messageUpdate).not.toHaveBeenCalled();
  });

  it("returns FAILED NO_RECIPIENT_EMAIL without calling the provider when the customer has no email", async () => {
    const result = await deliverOutboundEmailReply({ ...params, recipient: null });
    expect(result).toMatchObject({ channel: "EMAIL", status: "FAILED", reason: "NO_RECIPIENT_EMAIL" });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: { ticketId: "ticket-1", actorUserId: null, action: "EMAIL_DELIVERY_FAILED", newValue: "NO_RECIPIENT_EMAIL" } });
  });

  it("still returns SENT when the post-send provider-id write fails (reply is not deleted)", async () => {
    mocks.messageUpdate.mockRejectedValueOnce(new Error("db blip"));
    const result = await deliverOutboundEmailReply(params);
    expect(result).toEqual({ channel: "EMAIL", status: "SENT", externalId: "resend:email-out-1" });
  });
});
