import type { Request, RequestHandler } from "express";
import { AppError } from "../../../shared/errors/app-error.js";
import { getAppSecret, getVerifyToken } from "./whatsapp.config.js";
import { safeEqual, verifySignature } from "./whatsapp.signature.js";
import { extractInboundTextMessages, whatsappWebhookSchema } from "./whatsapp.schema.js";
import { processInboundTextMessage } from "./whatsapp.service.js";

function queryString(request: Request, key: string): string {
  const value = request.query[key];
  return typeof value === "string" ? value : "";
}

/**
 * GET /api/integrations/whatsapp/webhook
 * Meta webhook verification handshake. Echoes `hub.challenge` when the
 * `hub.verify_token` matches the configured value (constant-time compare).
 */
export const verifyWebhook: RequestHandler = (request, response, next) => {
  const verifyToken = getVerifyToken();
  if (!verifyToken) {
    next(new AppError(503, "WHATSAPP_NOT_CONFIGURED", "WhatsApp webhook verification is not configured"));
    return;
  }
  const mode = queryString(request, "hub.mode");
  const challenge = queryString(request, "hub.challenge");
  if (mode === "subscribe" && challenge && safeEqual(queryString(request, "hub.verify_token"), verifyToken)) {
    response.status(200).type("text/plain").send(challenge);
    return;
  }
  next(new AppError(403, "WHATSAPP_VERIFICATION_FAILED", "WhatsApp webhook verification failed"));
};

/**
 * POST /api/integrations/whatsapp/webhook
 * Receives WhatsApp events. The body arrives as a raw Buffer (see the route)
 * so the HMAC signature can be checked against the exact bytes Meta sent.
 */
export const receiveWebhook: RequestHandler = async (request, response, next) => {
  const appSecret = getAppSecret();
  if (!appSecret) {
    next(new AppError(503, "WHATSAPP_NOT_CONFIGURED", "WhatsApp webhook is not configured"));
    return;
  }

  const raw: Buffer = Buffer.isBuffer(request.body) ? request.body : Buffer.from("");
  if (!verifySignature(raw, request.header("x-hub-signature-256"), appSecret)) {
    next(new AppError(401, "WHATSAPP_INVALID_SIGNATURE", "Invalid webhook signature"));
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    next(new AppError(400, "WHATSAPP_INVALID_PAYLOAD", "Webhook payload is not valid JSON"));
    return;
  }

  const validation = whatsappWebhookSchema.safeParse(parsed);
  if (!validation.success) {
    // Structurally unexpected but signed — acknowledge so Meta does not retry.
    response.status(200).json({ received: true, processed: 0, ignored: true });
    return;
  }

  try {
    const messages = extractInboundTextMessages(validation.data);
    let processed = 0;
    for (const message of messages) {
      const result = await processInboundTextMessage(message);
      if (result.status !== "DUPLICATE") processed += 1;
    }
    response.status(200).json({ received: true, processed });
  } catch (error) {
    // Let Meta retry on a transient processing failure.
    next(error);
  }
};
