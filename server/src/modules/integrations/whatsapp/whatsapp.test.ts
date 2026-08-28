import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  messageFindUnique: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userFindMany: vi.fn(),
  customerFindMany: vi.fn(),
  customerFindUnique: vi.fn(),
  customerCreate: vi.fn(),
  ticketFindFirst: vi.fn(),
  ticketCreate: vi.fn(),
  ticketUpdate: vi.fn(),
  historyCreate: vi.fn(),
  slaFindFirst: vi.fn(),
  notificationCreateMany: vi.fn(),
  transaction: vi.fn(),
  sendTextMessage: vi.fn(),
}));

vi.mock("../../../config/prisma.js", () => {
  const client = {
    ticketMessage: { findUnique: mocks.messageFindUnique, create: mocks.messageCreate, update: mocks.messageUpdate },
    user: { findFirst: mocks.userFindFirst, create: mocks.userCreate, findMany: mocks.userFindMany },
    customer: { findMany: mocks.customerFindMany, findUnique: mocks.customerFindUnique, create: mocks.customerCreate },
    ticket: { findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate, update: mocks.ticketUpdate },
    ticketHistory: { create: mocks.historyCreate },
    slaRule: { findFirst: mocks.slaFindFirst },
    notification: { createMany: mocks.notificationCreateMany },
    $transaction: mocks.transaction,
  };
  return { prisma: client };
});

vi.mock("./whatsapp.client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./whatsapp.client.js")>();
  return { ...actual, whatsappClient: { sendTextMessage: mocks.sendTextMessage }, sendTextMessage: mocks.sendTextMessage };
});

vi.mock("bcrypt", () => ({ default: { hash: vi.fn().mockResolvedValue("hashed") } }));

import { app } from "../../../app.js";
import { env } from "../../../config/env.js";
import { WhatsappApiError } from "./whatsapp.client.js";
import { deliverOutboundReply } from "./whatsapp.service.js";

type WhatsappEnv = {
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
};
const setEnv = (patch: WhatsappEnv) => Object.assign(env as WhatsappEnv, patch);

const APP_SECRET = "test-whatsapp-app-secret";
const VERIFY_TOKEN = "test-verify-token";

const textPayload = (overrides: Partial<{ id: string; from: string; body: string; name: string; type: string }> = {}) => ({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15550001111", phone_number_id: "pnid-1" },
            contacts: [{ profile: { name: overrides.name ?? "Sara Ali" }, wa_id: overrides.from ?? "15557654321" }],
            messages: [
              {
                from: overrides.from ?? "15557654321",
                id: overrides.id ?? "wamid.ABC123",
                timestamp: "1724840000",
                type: overrides.type ?? "text",
                text: { body: overrides.body ?? "Hello, I need help with my order" },
              },
            ],
          },
        },
      ],
    },
  ],
});

const signed = (body: string) => `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
const postWebhook = (payload: unknown, signature?: string) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const req = request(app).post("/api/integrations/whatsapp/webhook").set("Content-Type", "application/json");
  if (signature !== undefined) req.set("X-Hub-Signature-256", signature);
  return req.send(body);
};

describe("WhatsApp integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv({
      WHATSAPP_APP_SECRET: APP_SECRET,
      WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "pnid-1",
    });
    mocks.transaction.mockImplementation((arg: unknown) =>
      typeof arg === "function"
        ? (arg as (tx: unknown) => unknown)({
            ticketMessage: { findUnique: mocks.messageFindUnique, create: mocks.messageCreate, update: mocks.messageUpdate },
            user: { findFirst: mocks.userFindFirst, create: mocks.userCreate, findMany: mocks.userFindMany },
            customer: { findMany: mocks.customerFindMany, findUnique: mocks.customerFindUnique, create: mocks.customerCreate },
            ticket: { findFirst: mocks.ticketFindFirst, create: mocks.ticketCreate, update: mocks.ticketUpdate },
            ticketHistory: { create: mocks.historyCreate },
            slaRule: { findFirst: mocks.slaFindFirst },
            notification: { createMany: mocks.notificationCreateMany },
          })
        : Promise.all(arg as Promise<unknown>[]),
    );
    mocks.messageFindUnique.mockResolvedValue(null);
    mocks.messageCreate.mockResolvedValue({ id: "msg-1" });
    mocks.messageUpdate.mockResolvedValue({ id: "msg-1" });
    mocks.userFindFirst.mockResolvedValue({ id: "wa-system" }); // system author exists
    mocks.userCreate.mockResolvedValue({ id: "wa-system" });
    mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }]);
    mocks.customerFindMany.mockResolvedValue([]);
    mocks.customerFindUnique.mockResolvedValue(null);
    mocks.customerCreate.mockResolvedValue({ id: "cust-new" });
    mocks.ticketFindFirst.mockResolvedValue(null);
    mocks.ticketCreate.mockResolvedValue({ id: "ticket-new", status: "NEW", subject: "WhatsApp: Hello", assignedAgentId: null });
    mocks.ticketUpdate.mockResolvedValue({ id: "ticket-1" });
    mocks.historyCreate.mockResolvedValue({});
    mocks.slaFindFirst.mockResolvedValue({ firstResponseMinutes: 60, resolutionMinutes: 1440 });
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
    mocks.sendTextMessage.mockResolvedValue({ messageId: "wamid.OUT1" });
  });

  // ---------------------------------------------------------------------------
  // Webhook verification (GET)
  // ---------------------------------------------------------------------------
  describe("GET /webhook verification", () => {
    it("echoes the challenge when the verify token matches", async () => {
      const res = await request(app)
        .get("/api/integrations/whatsapp/webhook")
        .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "12345" });
      expect(res.status).toBe(200);
      expect(res.text).toBe("12345");
    });

    it("rejects a wrong verify token with 403", async () => {
      const res = await request(app)
        .get("/api/integrations/whatsapp/webhook")
        .query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "12345" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("WHATSAPP_VERIFICATION_FAILED");
    });

    it("returns 503 when the verify token is not configured", async () => {
      setEnv({ WHATSAPP_VERIFY_TOKEN: undefined });
      const res = await request(app)
        .get("/api/integrations/whatsapp/webhook")
        .query({ "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "1" });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("WHATSAPP_NOT_CONFIGURED");
    });
  });

  // ---------------------------------------------------------------------------
  // Webhook security (POST)
  // ---------------------------------------------------------------------------
  describe("POST /webhook security", () => {
    it("accepts a request with a valid signature", async () => {
      const body = JSON.stringify(textPayload());
      const res = await postWebhook(body, signed(body));
      expect(res.status).toBe(200);
    });

    it("rejects a request with an invalid signature", async () => {
      const res = await postWebhook(textPayload(), "sha256=deadbeef");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("WHATSAPP_INVALID_SIGNATURE");
      expect(mocks.messageCreate).not.toHaveBeenCalled();
    });

    it("rejects a request with no signature header", async () => {
      const res = await postWebhook(textPayload());
      expect(res.status).toBe(401);
    });

    it("returns 503 when the app secret is not configured", async () => {
      setEnv({ WHATSAPP_APP_SECRET: undefined });
      const res = await postWebhook(textPayload(), "sha256=whatever");
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("WHATSAPP_NOT_CONFIGURED");
    });

    it("returns 400 for a signed but non-JSON body", async () => {
      const body = "not-json";
      const res = await postWebhook(body, signed(body));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("WHATSAPP_INVALID_PAYLOAD");
    });
  });

  // ---------------------------------------------------------------------------
  // Inbound text messages
  // ---------------------------------------------------------------------------
  describe("inbound text message", () => {
    const send = (payload: unknown) => {
      const body = JSON.stringify(payload);
      return postWebhook(body, signed(body));
    };

    it("creates a new customer and a new WhatsApp ticket", async () => {
      const res = await send(textPayload());
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, processed: 1 });
      expect(mocks.customerCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ phone: "+15557654321", name: "Sara Ali" }) }),
      );
      expect(mocks.ticketCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: "WHATSAPP", customerId: "cust-new" }) }),
      );
      expect(mocks.messageCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ externalId: "wamid.ABC123", authorUserId: "wa-system", ticketId: "ticket-new" }),
        }),
      );
      expect(mocks.notificationCreateMany).toHaveBeenCalled();
    });

    it("matches an existing customer by phone number", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "cust-existing" }]);
      const res = await send(textPayload());
      expect(res.status).toBe(200);
      expect(mocks.customerCreate).not.toHaveBeenCalled();
      expect(mocks.ticketCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: "cust-existing" }) }),
      );
    });

    it("appends to an existing active WhatsApp ticket instead of creating one", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "cust-existing" }]);
      mocks.ticketFindFirst.mockResolvedValue({ id: "ticket-open", status: "OPEN", subject: "WhatsApp: earlier", assignedAgentId: "agent-1" });
      const res = await send(textPayload({ id: "wamid.SECOND" }));
      expect(res.status).toBe(200);
      expect(mocks.ticketCreate).not.toHaveBeenCalled();
      expect(mocks.messageCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ticketId: "ticket-open", externalId: "wamid.SECOND" }) }),
      );
    });

    it("moves a WAITING_CUSTOMER ticket back to IN_PROGRESS", async () => {
      mocks.customerFindMany.mockResolvedValue([{ id: "cust-existing" }]);
      mocks.ticketFindFirst.mockResolvedValue({ id: "ticket-wait", status: "WAITING_CUSTOMER", subject: "WhatsApp: q", assignedAgentId: null });
      await send(textPayload({ id: "wamid.THIRD" }));
      expect(mocks.ticketUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "ticket-wait" }, data: { status: "IN_PROGRESS" } }),
      );
      expect(mocks.historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "STATUS_CHANGED", newValue: "IN_PROGRESS" }) }),
      );
    });

    it("is idempotent — a repeated webhook event creates no duplicate message", async () => {
      mocks.messageFindUnique.mockResolvedValue({ id: "msg-existing" });
      const res = await send(textPayload());
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, processed: 0 });
      expect(mocks.messageCreate).not.toHaveBeenCalled();
      expect(mocks.ticketCreate).not.toHaveBeenCalled();
    });

    it("treats a unique-constraint race on externalId as a duplicate", async () => {
      mocks.messageCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" }),
      );
      const res = await send(textPayload());
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ processed: 0 });
    });

    it("ignores a non-text message", async () => {
      const res = await send(textPayload({ type: "image" }));
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, processed: 0 });
      expect(mocks.messageCreate).not.toHaveBeenCalled();
    });

    it("ignores a delivery-status-only event", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [{ id: "e", changes: [{ field: "messages", value: { statuses: [{ id: "wamid.x", status: "delivered" }] } }] }],
      };
      const res = await send(payload);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ processed: 0 });
      expect(mocks.messageCreate).not.toHaveBeenCalled();
    });

    it("acknowledges a structurally unexpected payload without processing", async () => {
      const res = await send({ hello: "world" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, processed: 0 });
    });

    it("provisions the login-less system author on first use", async () => {
      mocks.userFindFirst.mockResolvedValueOnce(null); // system user lookup inside the txn
      await send(textPayload());
      expect(mocks.userCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: "whatsapp-inbound@system.invalid", isActive: false }) }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Outbound delivery (deliverOutboundReply unit)
  // ---------------------------------------------------------------------------
  describe("deliverOutboundReply", () => {
    it("sends via the WhatsApp client and stores the provider id on success", async () => {
      const result = await deliverOutboundReply({ ticketId: "t1", messageId: "m1", to: "+15557654321", text: "On it" });
      expect(mocks.sendTextMessage).toHaveBeenCalledWith({ to: "+15557654321", text: "On it" });
      expect(result).toMatchObject({ channel: "WHATSAPP", status: "SENT", externalId: "wamid.OUT1" });
      expect(mocks.messageUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: { externalId: "wamid.OUT1" } });
    });

    it("fails without contacting the API when the integration is not configured", async () => {
      setEnv({ WHATSAPP_ACCESS_TOKEN: undefined });
      const result = await deliverOutboundReply({ ticketId: "t1", messageId: "m1", to: "+1555", text: "hi" });
      expect(mocks.sendTextMessage).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "FAILED", reason: "INTEGRATION_NOT_CONFIGURED" });
      expect(mocks.historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "WHATSAPP_DELIVERY_FAILED", newValue: "INTEGRATION_NOT_CONFIGURED" }) }),
      );
    });

    it("fails with NO_RECIPIENT_PHONE when the customer has no phone", async () => {
      const result = await deliverOutboundReply({ ticketId: "t1", messageId: "m1", to: null, text: "hi" });
      expect(mocks.sendTextMessage).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "FAILED", reason: "NO_RECIPIENT_PHONE" });
    });

    it("maps a Meta rejection to PROVIDER_REJECTED and records history", async () => {
      mocks.sendTextMessage.mockRejectedValue(new WhatsappApiError(true, "bad recipient"));
      const result = await deliverOutboundReply({ ticketId: "t1", messageId: "m1", to: "+1555", text: "hi" });
      expect(result).toMatchObject({ status: "FAILED", reason: "PROVIDER_REJECTED" });
      expect(mocks.historyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "WHATSAPP_DELIVERY_FAILED" }) }),
      );
    });

    it("maps a network error to PROVIDER_UNREACHABLE", async () => {
      mocks.sendTextMessage.mockRejectedValue(new WhatsappApiError(false, "socket hang up"));
      const result = await deliverOutboundReply({ ticketId: "t1", messageId: "m1", to: "+1555", text: "hi" });
      expect(result).toMatchObject({ status: "FAILED", reason: "PROVIDER_UNREACHABLE" });
    });
  });
});
