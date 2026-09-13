import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  messageFindUnique: vi.fn(),
  messageCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  customerFindMany: vi.fn(),
  customerCreate: vi.fn(),
  ticketFindFirst: vi.fn(),
  ticketCreate: vi.fn(),
  historyCreate: vi.fn(),
  slaFindFirst: vi.fn(),
  notificationCreateMany: vi.fn(),
  watcherFindMany: vi.fn(),
  userFindMany: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
  deliveryCreate: vi.fn(), deliveryFindUnique: vi.fn(), deliveryUpdate: vi.fn(), deliveryUpdateMany: vi.fn(),
}));

vi.mock("../../../config/prisma.js", () => ({
  prisma: {
    ticketMessage: { findUnique: mocks.messageFindUnique, create: mocks.messageCreate },
    user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, findMany: mocks.userFindMany },
    customer: { findMany: mocks.customerFindMany, create: mocks.customerCreate },
    ticket: { findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate },
    ticketHistory: { create: mocks.historyCreate },
    ticketWatcher: { findMany: mocks.watcherFindMany },
    slaRule: { findFirst: mocks.slaFindFirst },
    notification: { createMany: mocks.notificationCreateMany },
    auditLog: { create: mocks.auditCreate },
    messageDelivery: { create: mocks.deliveryCreate, findUnique: mocks.deliveryFindUnique, update: mocks.deliveryUpdate, updateMany: mocks.deliveryUpdateMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("bcrypt", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed") } }));
vi.mock("../../realtime/realtime.publisher.js", () => ({
  withRealtimeOutbox: (fn: () => unknown) => fn(),
  emitTicketMessageCreated: vi.fn(),
  emitTicketUpdated: vi.fn(),
  emitNotificationCreated: vi.fn(),
  emitNotificationRead: vi.fn(),
}));

import { env } from "../../../config/env.js";
import { errorHandler } from "../../../middleware/error-handler.js";
import { setSmsProviderForTests } from "./sms.provider.js";
import { smsIntegrationRouter } from "./sms.routes.js";
import { deliverSmsReply } from "./sms.service.js";
import { textBeeProvider } from "./textbee.provider.js";

const app = express();
app.use("/api/integrations/sms", smsIntegrationRouter);
app.use(errorHandler);

const original = {
  apiKey: env.TEXTBEE_API_KEY,
  deviceId: env.TEXTBEE_DEVICE_ID,
  webhookSecret: env.TEXTBEE_WEBHOOK_SECRET,
};

describe("SMS integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.TEXTBEE_API_KEY = "test-key";
    env.TEXTBEE_DEVICE_ID = "device-1";
    env.TEXTBEE_WEBHOOK_SECRET = "webhook-test-secret";
    mocks.transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => unknown)({
            ticketMessage: { findUnique: mocks.messageFindUnique, create: mocks.messageCreate },
            user: { findUnique: mocks.userFindUnique, create: mocks.userCreate, findMany: mocks.userFindMany },
            customer: { findMany: mocks.customerFindMany, create: mocks.customerCreate },
            ticket: { findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate },
            ticketHistory: { create: mocks.historyCreate },
            ticketWatcher: { findMany: mocks.watcherFindMany },
            slaRule: { findFirst: mocks.slaFindFirst },
            notification: { createMany: mocks.notificationCreateMany },
            auditLog: { create: mocks.auditCreate },
          })
        : Promise.all(arg as Promise<unknown>[]),
    );
    mocks.messageFindUnique.mockResolvedValue(null);
    mocks.messageCreate.mockResolvedValue({ id: "c3a0de37932e8b19746f20b22" });
    mocks.userFindUnique.mockResolvedValue({ id: "sms-system" });
    mocks.userCreate.mockResolvedValue({ id: "sms-system" });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.customerFindMany.mockResolvedValue([]);
    mocks.customerCreate.mockResolvedValue({ id: "cust-new" });
    mocks.ticketFindFirst.mockResolvedValue(null);
    mocks.ticketCreate.mockResolvedValue({ id: "cd3448751688c18a75abee51f", status: "OPEN", subject: "SMS: Hello", assignedAgentId: null, teamId: null });
    mocks.historyCreate.mockResolvedValue({});
    mocks.slaFindFirst.mockResolvedValue({ firstResponseMinutes: 60, resolutionMinutes: 1440 });
    mocks.notificationCreateMany.mockResolvedValue({ count: 0 });
    mocks.deliveryCreate.mockResolvedValue({});
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryFindUnique.mockResolvedValue({ attemptCount: 0, firstAttemptedAt: null, providerMessageId: null });
    mocks.deliveryUpdate.mockResolvedValue({});
    mocks.watcherFindMany.mockResolvedValue([]);
    mocks.auditCreate.mockResolvedValue({});
  });

  afterEach(() => {
    env.TEXTBEE_API_KEY = original.apiKey;
    env.TEXTBEE_DEVICE_ID = original.deviceId;
    env.TEXTBEE_WEBHOOK_SECRET = original.webhookSecret;
    setSmsProviderForTests(null);
    vi.unstubAllGlobals();
  });

  it("maps the TextBee request and returns the provider batch id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { success: true, smsBatchId: "batch-1" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(textBeeProvider.sendMessage({ to: "+15551230000", text: "Hello" })).resolves.toEqual({ externalId: "batch-1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.textbee.dev/api/v1/gateway/send-sms", expect.objectContaining({
      headers: expect.objectContaining({ "x-api-key": "test-key" }),
      body: JSON.stringify({ recipients: ["+15551230000"], message: "Hello", deviceId: "device-1" }),
    }));
  });

  it("classifies an AbortSignal.timeout abort as SMS_DELIVERY_UNREACHABLE (no 20s wait)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(textBeeProvider.sendMessage({ to: "+15551230000", text: "Hello" }))
      .rejects.toMatchObject({ statusCode: 504, code: "SMS_DELIVERY_UNREACHABLE" });
  });

  it("classifies a raw connection failure as SMS_DELIVERY_UNREACHABLE", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(textBeeProvider.sendMessage({ to: "+15551230000", text: "Hello" }))
      .rejects.toMatchObject({ statusCode: 504, code: "SMS_DELIVERY_UNREACHABLE" });
  });

  it("keeps a TextBee HTTP rejection distinct as SMS_DELIVERY_FAILED (provider responded)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(textBeeProvider.sendMessage({ to: "+15551230000", text: "Hello" }))
      .rejects.toMatchObject({ statusCode: 502, code: "SMS_DELIVERY_FAILED" });
  });

  it("keeps a TextBee body-level failure distinct as SMS_DELIVERY_FAILED", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { success: false, failureCount: 1 } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(textBeeProvider.sendMessage({ to: "+15551230000", text: "Hello" }))
      .rejects.toMatchObject({ statusCode: 502, code: "SMS_DELIVERY_FAILED" });
  });

  it("rejects a missing customer phone before invoking a provider", async () => {
    const sendMessage = vi.fn();
    setSmsProviderForTests({ sendMessage });
    await expect(deliverSmsReply({ to: null, text: "Hello" })).rejects.toMatchObject({ statusCode: 422, code: "CUSTOMER_PHONE_REQUIRED" });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rejects malformed and unsigned webhook payloads", async () => {
    const malformed = await request(app).post("/api/integrations/sms/webhook").set("content-type", "application/json").send("not-json");
    expect(malformed.status).toBe(401);
    expect(malformed.body.error.code).toBe("SMS_INVALID_SIGNATURE");
  });

  it("validates a signed webhook payload before processing", async () => {
    const body = JSON.stringify({ smsId: "sms-1", message: "Hello", deviceId: "device-1", webhookEvent: "MESSAGE_RECEIVED", sender: "not-a-phone", receivedAt: new Date().toISOString() });
    const signature = createHmac("sha256", "webhook-test-secret").update(body).digest("hex");
    const response = await request(app).post("/api/integrations/sms/webhook").set({ "content-type": "application/json", "x-signature": signature }).send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("SMS_INVALID_PAYLOAD");
  });

  describe("inbound SMS message", () => {
    const send = (overrides: Partial<{ smsId: string; message: string; sender: string; receivedAt: string }> = {}) => {
      const body = JSON.stringify({
        smsId: overrides.smsId ?? "sms-1",
        message: overrides.message ?? "Hello, I need help",
        deviceId: "device-1",
        webhookEvent: "MESSAGE_RECEIVED",
        sender: overrides.sender ?? "+14155552671",
        receivedAt: overrides.receivedAt ?? new Date().toISOString(),
      });
      const signature = createHmac("sha256", "webhook-test-secret").update(body).digest("hex");
      return request(app).post("/api/integrations/sms/webhook").set({ "content-type": "application/json", "x-signature": signature }).send(body);
    };

    it("creates a new customer, writes one CUSTOMER_CREATED audit row, and creates a ticket", async () => {
      const response = await send();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("TICKET_CREATED");
      expect(mocks.customerCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: { name: "+14155552671", phone: "+14155552671", email: "sms-14155552671@no-email.invalid" },
      }));
      // CUSTOMER_CREATED (unchanged) + CONV-044's new TICKET_CREATED — exactly two, both actorless.
      expect(mocks.auditCreate).toHaveBeenCalledTimes(2);
      expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          actorId: null,
          action: "CUSTOMER_CREATED",
          entityType: "CUSTOMER",
          entityId: "cust-new",
        }),
      }));
      expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ actorId: null, action: "TICKET_CREATED", entityType: "TICKET" }),
      }));
    });

    it("CONV-027/031: two customers sharing a normalized phone produce an AMBIGUOUS outcome with zero writes and no PII in the log", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "existing-customer" }, { id: "other-customer" }]);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const response = await send();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("AMBIGUOUS");
      expect(mocks.customerCreate).not.toHaveBeenCalled();
      expect(mocks.ticketCreate).not.toHaveBeenCalled();
      expect(mocks.messageCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = warnSpy.mock.calls[0]!.join(" ");
      expect(logged).not.toContain("+14155552671"); // no phone number logged
      expect(logged).not.toContain("existing-customer"); // no candidate customer id logged
      expect(logged).not.toContain("other-customer");
      expect(logged).toMatch(/correlationId=/);
      expect(logged).toMatch(/count=2/);
      warnSpy.mockRestore();
    });

    it("CONV-024/033 (OD-CC-4/OD-CC-3): always creates a NEW ticket, even for a customer with an existing active or RESOLVED SMS ticket — no newest-active-ticket reuse, no reopen", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "existing-customer" }]);
      const response = await send();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("TICKET_CREATED");
      expect(mocks.ticketFindFirst).not.toHaveBeenCalled(); // no "newest active ticket" lookup exists at all
      expect(mocks.ticketCreate).toHaveBeenCalledTimes(1);
    });

    it("does not audit CUSTOMER_CREATED when an existing customer is matched by phone (TICKET_CREATED still fires once, CONV-044)", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "existing-customer" }]);
      const response = await send();
      expect(response.status).toBe(200);
      expect(mocks.customerCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
      expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: "TICKET_CREATED", actorId: null }),
      }));
    });

    it("does not re-process or double-audit a duplicate webhook redelivery", async () => {
      mocks.messageFindUnique.mockResolvedValue({ id: "already-processed" });
      const response = await send();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("DUPLICATE");
      expect(mocks.customerCreate).not.toHaveBeenCalled();
      expect(mocks.ticketCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("CONV-021 (CC-GAP-03 fix): a raced externalId P2002 inside the transaction is classified DUPLICATE", async () => {
      mocks.messageCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["TicketMessage_externalId_key"] } }),
      );
      const response = await send();
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("DUPLICATE");
    });

    it("CONV-021 (CC-GAP-03 fix): an unrelated P2002 (e.g. placeholder-email collision) propagates as a real error, not DUPLICATE", async () => {
      mocks.customerCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6", meta: { target: ["Customer_email_key"] } }),
      );
      const response = await send();
      expect(response.status).toBe(500);
      expect(response.body.status).not.toBe("DUPLICATE");
    });
  });
});
