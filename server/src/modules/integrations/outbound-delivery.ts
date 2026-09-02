import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";

/**
 * Shared vocabulary for outbound staff-reply delivery across the provider-backed
 * ticket channels (WhatsApp, Email, SMS).
 *
 * The architectural contract (see ADR-052): the local `TicketMessage` and its
 * transactional side effects are committed FIRST; the external provider is
 * attempted AFTER commit. A provider or configuration failure is reported to the
 * caller as `{ status: "FAILED", reason }` and recorded as a
 * `<CHANNEL>_DELIVERY_FAILED` ticket-history row — it never rolls back the
 * persisted reply. WhatsApp already followed this pattern with its own local
 * helpers; Email and SMS now share the pieces below.
 */

export type OutboundChannel = "WHATSAPP" | "EMAIL" | "SMS";

export type OutboundDeliveryStatus = "SENT" | "FAILED";

export type OutboundDeliveryFailureReason =
  | "INTEGRATION_NOT_CONFIGURED"
  | "NO_RECIPIENT_PHONE"
  | "NO_RECIPIENT_EMAIL"
  | "RECIPIENT_INVALID"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNREACHABLE";

export interface OutboundDeliveryResult {
  channel: OutboundChannel;
  status: OutboundDeliveryStatus;
  /** Present when `status === "SENT"` and the provider returned an id. */
  externalId?: string;
  /** Present when `status === "FAILED"`. */
  reason?: OutboundDeliveryFailureReason;
}

/**
 * Structured `AppError` codes thrown by the provider adapters → a non-secret
 * delivery-failure reason. Anything unmapped (a raw network throw, DNS failure,
 * socket hang-up, `AbortError` / timeout) falls through to `PROVIDER_UNREACHABLE`.
 */
const REASON_BY_ERROR_CODE: Record<string, OutboundDeliveryFailureReason> = {
  EMAIL_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  EMAIL_SENDER_INVALID: "INTEGRATION_NOT_CONFIGURED",
  SMS_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  EMAIL_RECIPIENT_INVALID: "RECIPIENT_INVALID",
  CUSTOMER_PHONE_REQUIRED: "NO_RECIPIENT_PHONE",
  EMAIL_DELIVERY_FAILED: "PROVIDER_REJECTED",
  SMS_DELIVERY_FAILED: "PROVIDER_REJECTED",
  SMS_MESSAGE_TOO_LONG: "PROVIDER_REJECTED",
  EMPTY_MESSAGE: "PROVIDER_REJECTED",
};

export function outboundFailureReason(error: unknown): OutboundDeliveryFailureReason {
  if (error instanceof AppError) {
    const mapped = REASON_BY_ERROR_CODE[error.code];
    if (mapped) return mapped;
  }
  return "PROVIDER_UNREACHABLE";
}

/**
 * Record an outbound provider-delivery failure as a `<CHANNEL>_DELIVERY_FAILED`
 * ticket-history row and return the FAILED result. Mirrors
 * `whatsapp.service.ts#recordDeliveryFailure`.
 *
 * The reply row is already committed by the caller, so a failed history write is
 * only logged — it must never throw back into the request and undo a delivered
 * or persisted reply. `newValue` carries only the coarse reason category; no
 * provider payloads, credentials, or secrets are persisted.
 */
export async function recordOutboundDeliveryFailure(params: {
  channel: OutboundChannel;
  ticketId: string;
  reason: OutboundDeliveryFailureReason;
}): Promise<OutboundDeliveryResult> {
  try {
    await prisma.ticketHistory.create({
      data: {
        ticketId: params.ticketId,
        actorUserId: null,
        action: `${params.channel}_DELIVERY_FAILED`,
        newValue: params.reason,
      },
    });
  } catch (error) {
    console.error(`${params.channel.toLowerCase()}: failed to record delivery failure`, error);
  }
  return { channel: params.channel, status: "FAILED", reason: params.reason };
}
