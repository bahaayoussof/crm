import type { RequestHandler } from "express";
import { AppError } from "../../../shared/errors/app-error.js";
import { requireInboundEmailConfig } from "./email.config.js";
import { emailClient } from "./email.client.js";
import { extractReceivedEvent } from "./email.schema.js";
import { processInboundEmail } from "./email.service.js";

function requiredHeader(value: string | undefined, name: string) {
  if (!value) throw new AppError(401, "INVALID_WEBHOOK_SIGNATURE", `Missing ${name} webhook header`);
  return value;
}

export const receiveEmailWebhook: RequestHandler = async (request, response) => {
  const config = requireInboundEmailConfig();
  if (!Buffer.isBuffer(request.body)) throw new AppError(400, "INVALID_WEBHOOK_BODY", "Webhook body must be raw bytes");
  const payload = request.body.toString("utf8");
  let verified: unknown;
  try {
    verified = emailClient.verifyResendWebhook({
      apiKey: config.apiKey,
      webhookSecret: config.webhookSecret,
      payload,
      headers: {
        id: requiredHeader(request.header("svix-id"), "svix-id"),
        timestamp: requiredHeader(request.header("svix-timestamp"), "svix-timestamp"),
        signature: requiredHeader(request.header("svix-signature"), "svix-signature"),
      },
    });
  } catch {
    throw new AppError(401, "INVALID_WEBHOOK_SIGNATURE", "Invalid email webhook signature");
  }
  const event = extractReceivedEvent(verified);
  if (!event) {
    response.status(200).json({ data: { status: "IGNORED" } });
    return;
  }
  const result = await processInboundEmail(event);
  response.status(200).json({ data: result });
};
