import type { RequestHandler } from "express";
import { AppError } from "../../../shared/errors/app-error.js";
import { requireSmsWebhookSecret } from "./sms.config.js";
import { smsWebhookSchema } from "./sms.schema.js";
import { processInboundSms } from "./sms.service.js";
import { verifySmsSignature } from "./sms.signature.js";

export const receiveSmsWebhook: RequestHandler = async (request, response, next) => {
  const raw = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  try {
    if (!verifySmsSignature(raw, request.header("x-signature"), requireSmsWebhookSecret())) throw new AppError(401, "SMS_INVALID_SIGNATURE", "Invalid SMS webhook signature");
    let parsed: unknown;
    try { parsed = JSON.parse(raw.toString("utf8")); } catch { throw new AppError(400, "SMS_INVALID_PAYLOAD", "SMS webhook payload is not valid JSON"); }
    const payload = smsWebhookSchema.safeParse(parsed);
    if (!payload.success) throw new AppError(400, "SMS_INVALID_PAYLOAD", "SMS webhook payload is invalid");
    const result = await processInboundSms({ externalId: payload.data.smsId, from: payload.data.sender, text: payload.data.message, receivedAt: payload.data.receivedAt });
    response.status(200).json({ received: true, status: result.status });
  } catch (error) { next(error); }
};

