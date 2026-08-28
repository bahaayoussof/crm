/**
 * Internal types for the WhatsApp Cloud API integration.
 * These are the CRM-facing shapes; the raw Meta webhook payload is validated
 * and narrowed by whatsapp.schema.ts before anything here is produced.
 */

/** A single inbound WhatsApp text message, normalized for the ticket pipeline. */
export interface InboundTextMessage {
  /** Meta message id (wamid...). Idempotency anchor for webhook de-duplication. */
  externalId: string;
  /** Sender phone in WhatsApp wire format (digits, no "+"). */
  from: string;
  /** WhatsApp profile display name, when the payload includes it. */
  profileName: string | null;
  /** Message text body. */
  text: string;
  /** Unix seconds from the payload; used as the message timestamp when sane. */
  timestamp: number;
}

export type InboundResultStatus =
  | "TICKET_CREATED"
  | "MESSAGE_APPENDED"
  | "DUPLICATE";

export interface InboundResult {
  status: InboundResultStatus;
  ticketId?: string;
  messageId?: string;
}

export type OutboundDeliveryStatus = "SENT" | "FAILED";

export type OutboundFailureReason =
  | "INTEGRATION_NOT_CONFIGURED"
  | "NO_RECIPIENT_PHONE"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNREACHABLE";

export interface OutboundDeliveryResult {
  channel: "WHATSAPP";
  status: OutboundDeliveryStatus;
  /** Present when status === "SENT". */
  externalId?: string;
  /** Present when status === "FAILED". */
  reason?: OutboundFailureReason;
}
