import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../../audit-logs/audit-log.service.js";
import { normalizePhoneNumber } from "../../../shared/utils/phone.js";
import { resolveCustomerByPhone } from "../../customers/resolve-customer-by-phone.js";
import { customerReplyNotificationRecipientIds } from "../../../shared/team/team-scope.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { getSmsProvider } from "./sms.provider.js";
import { createCanonicalTicket } from "../../tickets/create-canonical-ticket.js";
import type { InboundSms } from "./sms.types.js";
import {
  type OutboundDeliveryResult,
  outboundFailureReason,
  recordOutboundDeliveryFailure,
  claimDeliveryForAttempt,
  recordDeliveryOutcome,
  skippedClaimResult,
} from "../outbound-delivery.js";

const SYSTEM_EMAIL = "sms-inbound@system.invalid";
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

/**
 * CONV-021 (CC-GAP-03 fix): only a violation of the inbound-message unique
 * constraint (`TicketMessage.externalId`, the pre-CONV-016 SMS inbound-key
 * equivalent) means a duplicate provider delivery. Any other `P2002` inside
 * this transaction — e.g. a placeholder-email collision — must propagate as
 * a real error instead of silently dropping the inbound message.
 */
function isDuplicateSmsMessageConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const targets = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return targets.some((t) => String(t).toLowerCase().includes("externalid"));
}

export async function deliverSmsReply(input: { to: string | null; text: string }) {
  if (!input.to) throw new AppError(422, "CUSTOMER_PHONE_REQUIRED", "Ticket customer must have a phone number for SMS");
  const phone = normalizePhoneNumber(input.to);
  if (!phone) throw new AppError(422, "CUSTOMER_PHONE_REQUIRED", "Ticket customer must have a valid international phone number for SMS");
  const text = input.text.trim();
  if (!text) throw new AppError(422, "EMPTY_MESSAGE", "SMS message body is required");
  if (text.length > 20_000) throw new AppError(422, "SMS_MESSAGE_TOO_LONG", "SMS message must be 20,000 characters or fewer");
  const result = await (await getSmsProvider()).sendMessage({ to: phone, text });
  return { channel: "SMS" as const, status: "SENT" as const, externalId: result.externalId };
}

/**
 * Deliver an already-persisted staff reply to the customer over SMS.
 *
 * The `TicketMessage` and its transactional side effects are committed by the
 * ticket service BEFORE this runs (mirrors the WhatsApp seam), so a provider or
 * configuration failure never rolls back the conversation. Failures are returned
 * as `{ status: "FAILED", reason }` and recorded as an `SMS_DELIVERY_FAILED`
 * ticket-history row. On success the TextBee batch id, when present, is written
 * onto the committed row in a second, best-effort update.
 */
export async function deliverOutboundSmsReply(params: {
  ticketId: string;
  messageId: string;
  to: string | null;
  text: string;
}): Promise<OutboundDeliveryResult> {
  if (!params.to) {
    await recordDeliveryOutcome(params.messageId, { status: "FAILED", errorCode: "NO_RECIPIENT_PHONE", terminal: true });
    return recordOutboundDeliveryFailure({ channel: "SMS", ticketId: params.ticketId, reason: "NO_RECIPIENT_PHONE" });
  }
  // CONV-037/038: claim the durable delivery row for this attempt; a lost
  // claim (already leased/terminal) skips the provider call entirely.
  const claimed = await claimDeliveryForAttempt(params.messageId);
  if (!claimed) return skippedClaimResult("SMS", params.messageId);
  let result: { externalId?: string };
  try {
    // `deliverSmsReply` is the single validator/sender: it rejects a missing or
    // non-E.164 phone (→ NO_RECIPIENT_PHONE) and an over-long / empty body before
    // ever touching the provider, then dispatches through the configured gateway.
    result = await deliverSmsReply({ to: params.to, text: params.text });
  } catch (error) {
    const reason = outboundFailureReason(error);
    await recordDeliveryOutcome(params.messageId, { status: "FAILED", errorCode: reason, errorMessage: error instanceof Error ? error.message : undefined });
    return recordOutboundDeliveryFailure({ channel: "SMS", ticketId: params.ticketId, reason });
  }
  // CONV-037: MessageDelivery.providerMessageId is now the source of truth —
  // TicketMessage.externalId is no longer written for new outbound sends.
  await recordDeliveryOutcome(params.messageId, { status: "SENT", providerMessageId: result.externalId })
    .catch((error) => console.error("sms: sent reply but could not record delivery outcome", error));
  return { channel: "SMS", status: "SENT", externalId: result.externalId };
}

async function systemUser(tx: Prisma.TransactionClient) {
  return (await tx.user.findUnique({ where: { email: SYSTEM_EMAIL }, select: { id: true } })) ?? tx.user.create({
    data: { name: "SMS Customer", email: SYSTEM_EMAIL, passwordHash: await bcrypt.hash(randomUUID(), 10), role: Role.CUSTOMER, isActive: false }, select: { id: true },
  });
}

export async function processInboundSms(input: InboundSms) {
 return withRealtimeOutbox(async () => {
  const outcome = await prisma.$transaction(async (tx) => {
    if (await tx.ticketMessage.findUnique({ where: { externalId: input.externalId }, select: { id: true } })) return { status: "DUPLICATE" as const };
    const phone = normalizePhoneNumber(input.from);
    if (!phone) throw new AppError(422, "INVALID_SMS_SENDER", "Inbound SMS sender is invalid");
    const digits = phone.replace(/\D/g, "");
    // CONV-027 (OD-CC-6, CC-GAP-21): shared phone resolver (CONV-015) instead
    // of SMS's own ordered-match-and-take-newest logic. Ambiguity stops
    // automatic resolution entirely — no customer/ticket/message write.
    const resolved = await resolveCustomerByPhone(tx, input.from, { id: true });
    if (resolved.kind === "ambiguous") {
      console.warn(`sms: ambiguous phone match — correlationId=${resolved.correlationId} channel=SMS count=${resolved.candidateCount}`);
      return { status: "AMBIGUOUS" as const };
    }
    let customer = resolved.kind === "one" ? resolved.customer : null;
    if (!customer) {
      const email = `sms-${digits}@no-email.invalid`;
      customer = await tx.customer.create({ data: { name: phone, phone, email }, select: { id: true } });
      await createAuditLog({
        actorId: null,
        action: AUDIT_ACTIONS.CUSTOMER_CREATED,
        entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
        entityId: customer.id,
        changes: { name: { to: phone }, phone: { to: phone }, email: { to: email } },
      }, tx);
    }
    const author = await systemUser(tx);
    // CONV-024 (OD-CC-4): TextBee exposes no reliable thread/message
    // correlation beyond phone identity, so every inbound SMS without a
    // stronger signal creates a new ticket — never the "newest active SMS
    // ticket" heuristic. This also trivially satisfies OD-CC-3 (never reopen
    // RESOLVED from identity/phone matching): there is no lookup to reopen.
    const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
    // Inbound SMS tickets have no Team at creation (teamId null), so automatic
    // assignment does not run here — the ticket waits for ADMIN routing, then
    // the canonical ticket update flow auto-assigns it once a Team is set.
    const canonical = await createCanonicalTicket({
      tx,
      data: { subject: `SMS: ${input.text.replace(/\s+/g, " ").slice(0, 60)}`, description: input.text, customerId: customer.id, channel: Channel.SMS, priority: TicketPriority.MEDIUM, status: TicketStatus.OPEN, firstResponseDueAt: sla ? addMinutes(input.receivedAt, sla.firstResponseMinutes) : null, resolutionDueAt: sla ? addMinutes(input.receivedAt, sla.resolutionMinutes) : null },
      actorId: null,
    });
    const ticket = canonical.ticket;
    const message = await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorUserId: author.id, body: input.text, externalId: input.externalId, createdAt: input.receivedAt, contentFormat: "PLAIN_TEXT", contentSource: "SMS" }, select: { id: true } });
    // Shared CUSTOMER_REPLY targeting (same rule for every channel): assigned
    // agent + ONLY this ticket's team manager (Ticket.teamId) + watchers, with
    // an ADMIN fallback only for an unrouted/unassigned/unwatched ticket.
    const recipients = await customerReplyNotificationRecipientIds(tx, { ticketId: ticket.id, teamId: ticket.teamId, assignedAgentId: ticket.assignedAgentId });
    await createNotifications(tx, recipients, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${ticket.id}: ${ticket.subject}`, ticket.id);
    return { status: "TICKET_CREATED" as const, ticketId: ticket.id, messageId: message.id, assignedAgentId: ticket.assignedAgentId, customerId: customer.id, teamId: ticket.teamId };
  }).catch((error) => {
    if (isDuplicateSmsMessageConflict(error)) return { status: "DUPLICATE" as const };
    throw error;
  });
  if (outcome.status === "TICKET_CREATED") emitTicketMessageCreated({ ticketId: outcome.ticketId, messageId: outcome.messageId, assignedAgentId: outcome.assignedAgentId, customerId: outcome.customerId, teamId: outcome.teamId, visibility: "public" });
  return outcome;
 });
}
