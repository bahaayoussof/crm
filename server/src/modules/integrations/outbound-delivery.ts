import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { emitTicketUpdated } from "../realtime/realtime.publisher.js";

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
 * `EMAIL_DELIVERY_TIMEOUT` and `SMS_DELIVERY_UNREACHABLE` are mapped explicitly
 * for the same reason, so an outbound Resend / TextBee request that times out or
 * never connects is reported as `PROVIDER_UNREACHABLE`, never `PROVIDER_REJECTED`
 * — the latter stays reserved for a provider that responded and rejected the send
 * (`EMAIL_DELIVERY_FAILED` / `SMS_DELIVERY_FAILED`).
 */
const REASON_BY_ERROR_CODE: Record<string, OutboundDeliveryFailureReason> = {
  EMAIL_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  EMAIL_SENDER_INVALID: "INTEGRATION_NOT_CONFIGURED",
  SMS_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",
  EMAIL_RECIPIENT_INVALID: "RECIPIENT_INVALID",
  CUSTOMER_PHONE_REQUIRED: "NO_RECIPIENT_PHONE",
  EMAIL_DELIVERY_FAILED: "PROVIDER_REJECTED",
  EMAIL_DELIVERY_TIMEOUT: "PROVIDER_UNREACHABLE",
  SMS_DELIVERY_FAILED: "PROVIDER_REJECTED",
  SMS_DELIVERY_UNREACHABLE: "PROVIDER_UNREACHABLE",
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

/**
 * CONV-017 — durable per-message delivery primitives (OD-CC-1, CC-GAP-05).
 * These build the channel-neutral seam that CONV-036/037/038 wire into the
 * staff-reply transaction and the bounded retry endpoint. No orchestration
 * lives here yet — just the atomic building blocks.
 */

export const OUTBOUND_MAX_ATTEMPTS = 3;
const CLAIM_LEASE_MS = 60_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000]; // 1m after attempt 1, 5m after attempt 2
const LAST_ERROR_MESSAGE_MAX_CHARS = 500;

export async function createPendingDelivery(
  messageId: string,
  channel: OutboundChannel,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.messageDelivery.create({ data: { messageId, channel, status: "PENDING", attemptCount: 0 } });
}

/**
 * Atomically claim one delivery row for an attempt. Returns `null` when the
 * row is already leased (an unexpired `claimedUntil`) or in a terminal state
 * (`SENT`/`DELIVERED`/`FAILED`) — an overlapping sweep invocation safely skips it.
 */
export async function claimDeliveryForAttempt(messageId: string, now: Date = new Date()) {
  const claimedUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
  const result = await prisma.messageDelivery.updateMany({
    where: {
      messageId,
      status: { in: ["PENDING", "SENDING"] },
      OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
    },
    data: { status: "SENDING", claimedUntil },
  });
  if (result.count !== 1) return null;
  return prisma.messageDelivery.findUnique({ where: { messageId } });
}

/**
 * Build an honest `OutboundDeliveryResult` when a claim is lost (row already
 * leased by an overlapping call, or already terminal) — reflects the row's
 * actual current state instead of fabricating an outcome for this call.
 */
export async function skippedClaimResult(channel: OutboundChannel, messageId: string): Promise<OutboundDeliveryResult> {
  const current = await prisma.messageDelivery.findUnique({ where: { messageId }, select: { status: true, providerMessageId: true, lastErrorCode: true } });
  if (current?.status === "SENT" || current?.status === "DELIVERED") {
    return { channel, status: "SENT", externalId: current.providerMessageId ?? undefined };
  }
  return { channel, status: "FAILED", reason: (current?.lastErrorCode as OutboundDeliveryFailureReason) ?? "PROVIDER_UNREACHABLE" };
}

function nextAttemptDelay(attemptCount: number): number | null {
  return RETRY_DELAYS_MS[attemptCount - 1] ?? null;
}

export type DeliveryOutcomeInput =
  | { status: "SENT"; providerMessageId?: string | null }
  | { status: "FAILED"; errorCode?: string | null; errorMessage?: string | null; terminal?: boolean };

/**
 * Record the outcome of one delivery attempt. Increments `attemptCount`
 * exactly once per call. A `FAILED` outcome becomes terminal (`FAILED`
 * status, `nextAttemptAt: null`) once `OUTBOUND_MAX_ATTEMPTS` is reached or
 * the caller marks it non-retryable; otherwise it stays `PENDING` with a
 * scheduled `nextAttemptAt` (1m after attempt 1, 5m after attempt 2).
 */
export async function recordDeliveryOutcome(messageId: string, outcome: DeliveryOutcomeInput) {
  const now = new Date();
  const current = await prisma.messageDelivery.findUnique({ where: { messageId } });
  if (!current) return null;
  const attemptCount = current.attemptCount + 1;
  const firstAttemptedAt = current.firstAttemptedAt ?? now;

  if (outcome.status === "SENT") {
    return prisma.messageDelivery.update({
      where: { messageId },
      data: {
        status: "SENT",
        providerMessageId: outcome.providerMessageId ?? current.providerMessageId,
        attemptCount,
        firstAttemptedAt,
        lastAttemptedAt: now,
        sentAt: now,
        claimedUntil: null,
        nextAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  }

  const isTerminal = Boolean(outcome.terminal) || attemptCount >= OUTBOUND_MAX_ATTEMPTS;
  const delay = isTerminal ? null : nextAttemptDelay(attemptCount);
  return prisma.messageDelivery.update({
    where: { messageId },
    data: {
      status: isTerminal ? "FAILED" : "PENDING",
      attemptCount,
      firstAttemptedAt,
      lastAttemptedAt: now,
      failedAt: isTerminal ? now : null,
      claimedUntil: null,
      nextAttemptAt: delay ? new Date(now.getTime() + delay) : null,
      lastErrorCode: outcome.errorCode ?? null,
      lastErrorMessage: outcome.errorMessage ? outcome.errorMessage.slice(0, LAST_ERROR_MESSAGE_MAX_CHARS) : null,
    },
  });
}

const TERMINAL_DELIVERY_STATUSES = new Set(["DELIVERED", "FAILED"]);

export type DeliveryCallbackOutcome = { status: "SENT" | "DELIVERED" | "FAILED"; errorCode?: string | null; errorMessage?: string | null };
export type DeliveryCallbackApplyResult = { applied: true } | { applied: false; reason: "UNKNOWN" | "TERMINAL_NO_OP" };

/**
 * Apply a supported provider delivery callback by `(channel, providerMessageId)`
 * identity. Idempotent and monotonic: once a delivery row reaches a terminal
 * state (`DELIVERED` or `FAILED`), every subsequent callback — including a
 * stale/out-of-order "sent" after "delivered" — is a safe no-op, never an
 * error and never a downgrade.
 */
export async function recordDeliveryCallback(
  channel: OutboundChannel,
  providerMessageId: string,
  outcome: DeliveryCallbackOutcome,
): Promise<DeliveryCallbackApplyResult> {
  const current = await prisma.messageDelivery.findUnique({ where: { channel_providerMessageId: { channel, providerMessageId } } });
  if (!current) return { applied: false, reason: "UNKNOWN" };
  if (TERMINAL_DELIVERY_STATUSES.has(current.status)) return { applied: false, reason: "TERMINAL_NO_OP" };

  const now = new Date();
  await prisma.messageDelivery.update({
    where: { id: current.id },
    data: {
      status: outcome.status,
      lastAttemptedAt: now,
      ...(outcome.status === "SENT" && { sentAt: current.sentAt ?? now }),
      ...(outcome.status === "DELIVERED" && { deliveredAt: now }),
      ...(outcome.status === "FAILED" && {
        failedAt: now,
        lastErrorCode: outcome.errorCode ?? null,
        lastErrorMessage: outcome.errorMessage ? outcome.errorMessage.slice(0, LAST_ERROR_MESSAGE_MAX_CHARS) : null,
      }),
    },
  });
  return { applied: true };
}

/**
 * CONV-040 — apply a supported provider delivery callback and, only on a
 * genuine state change, emit exactly one `ticket.updated` (CONV-053). Never
 * emits on `UNKNOWN`/`TERMINAL_NO_OP` — those are safe no-ops by contract.
 */
export async function applyDeliveryCallback(
  channel: OutboundChannel,
  providerMessageId: string,
  outcome: DeliveryCallbackOutcome,
): Promise<DeliveryCallbackApplyResult> {
  const result = await recordDeliveryCallback(channel, providerMessageId, outcome);
  if (!result.applied) return result;

  const delivery = await prisma.messageDelivery.findUnique({
    where: { channel_providerMessageId: { channel, providerMessageId } },
    select: {
      message: {
        select: {
          ticket: { select: { id: true, teamId: true, assignedAgentId: true, customer: { select: { id: true } } } },
        },
      },
    },
  });
  const ticket = delivery?.message?.ticket;
  if (ticket) {
    emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: ticket.assignedAgentId, customerId: ticket.customer?.id ?? null, teamId: ticket.teamId });
  }
  return result;
}
