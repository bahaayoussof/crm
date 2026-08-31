import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { emailSchema } from "../../../shared/validation/common.schema.js";

function configuredFrom(): string | null {
  const address = env.EMAIL_FROM?.trim();
  if (!address) return null;
  if (address.includes("<")) return address;
  return env.EMAIL_FROM_NAME ? `${env.EMAIL_FROM_NAME} <${address}>` : address;
}

export function requireOutboundEmailConfig() {
  const from = configuredFrom();
  if (!env.RESEND_API_KEY || !from) {
    throw new AppError(503, "EMAIL_NOT_CONFIGURED", "Email sending requires RESEND_API_KEY and EMAIL_FROM");
  }
  const address = from.match(/<([^<>]+)>/)?.[1] ?? from;
  if (!emailSchema.safeParse(address).success) {
    throw new AppError(503, "EMAIL_SENDER_INVALID", "EMAIL_FROM must contain a valid sender email address");
  }
  return { apiKey: env.RESEND_API_KEY, from, inboundAddress: env.EMAIL_INBOUND_ADDRESS ?? null };
}

export function requireInboundEmailConfig() {
  if (!env.RESEND_API_KEY || !env.RESEND_WEBHOOK_SECRET || !env.EMAIL_INBOUND_ADDRESS) {
    throw new AppError(
      503,
      "EMAIL_WEBHOOK_NOT_CONFIGURED",
      "Inbound email requires RESEND_API_KEY, RESEND_WEBHOOK_SECRET, and EMAIL_INBOUND_ADDRESS",
    );
  }
  return {
    apiKey: env.RESEND_API_KEY,
    webhookSecret: env.RESEND_WEBHOOK_SECRET,
    inboundAddress: env.EMAIL_INBOUND_ADDRESS,
  };
}
