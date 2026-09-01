import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";

export function requireSmsConfig() {
  if (!env.TEXTBEE_API_KEY || !env.TEXTBEE_DEVICE_ID) {
    throw new AppError(503, "SMS_NOT_CONFIGURED", "SMS sending requires TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID");
  }
  return { apiKey: env.TEXTBEE_API_KEY, deviceId: env.TEXTBEE_DEVICE_ID, baseUrl: env.TEXTBEE_BASE_URL };
}

export function requireSmsWebhookSecret() {
  if (!env.TEXTBEE_WEBHOOK_SECRET) throw new AppError(503, "SMS_WEBHOOK_NOT_CONFIGURED", "SMS webhook verification is not configured");
  return env.TEXTBEE_WEBHOOK_SECRET;
}

