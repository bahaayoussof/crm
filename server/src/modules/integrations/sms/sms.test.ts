import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    env.TEXTBEE_API_KEY = "test-key";
    env.TEXTBEE_DEVICE_ID = "device-1";
    env.TEXTBEE_WEBHOOK_SECRET = "webhook-test-secret";
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
});
