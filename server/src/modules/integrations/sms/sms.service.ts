import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { normalizePhoneNumber } from "../../../shared/utils/phone.js";
import { customerReplyNotificationRecipientIds } from "../../../shared/team/team-scope.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { getSmsProvider } from "./sms.provider.js";
import type { InboundSms } from "./sms.types.js";
import {
  type OutboundDeliveryResult,
  outboundFailureReason,
  recordOutboundDeliveryFailure,
} from "../outbound-delivery.js";

const ACTIVE = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_CUSTOMER, TicketStatus.ESCALATED] as const;
const SYSTEM_EMAIL = "sms-inbound@system.invalid";
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

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
    return recordOutboundDeliveryFailure({ channel: "SMS", ticketId: params.ticketId, reason: "NO_RECIPIENT_PHONE" });
  }
  let result: { externalId?: string };
  try {
    // `deliverSmsReply` is the single validator/sender: it rejects a missing or
    // non-E.164 phone (→ NO_RECIPIENT_PHONE) and an over-long / empty body before
    // ever touching the provider, then dispatches through the configured gateway.
    result = await deliverSmsReply({ to: params.to, text: params.text });
  } catch (error) {
    return recordOutboundDeliveryFailure({
      channel: "SMS",
      ticketId: params.ticketId,
      reason: outboundFailureReason(error),
    });
  }
  if (result.externalId) {
    await prisma.ticketMessage
      .update({ where: { id: params.messageId }, data: { externalId: result.externalId } })
      .catch((error) => console.error("sms: sent reply but could not store provider id", error));
  }
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
    const matches = await tx.customer.findMany({ where: { OR: [{ phone }, { phone: digits }, { phone: input.from }] }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { id: true } });
    let customer = matches[0];
    if (!customer) customer = await tx.customer.create({ data: { name: phone, phone, email: `sms-${digits}@no-email.invalid` }, select: { id: true } });
    const author = await systemUser(tx);
    let ticket = await tx.ticket.findFirst({ where: { customerId: customer.id, channel: Channel.SMS, status: { in: [...ACTIVE] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, status: true, subject: true, assignedAgentId: true, teamId: true } });
    const created = !ticket;
    if (!ticket) {
      const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
      // Inbound SMS tickets have no Team at creation (teamId null), so automatic
      // assignment does not run here — the ticket waits for ADMIN routing, then
      // the canonical ticket update flow auto-assigns it once a Team is set.
      ticket = await tx.ticket.create({ data: { subject: `SMS: ${input.text.replace(/\s+/g, " ").slice(0, 60)}`, description: input.text, customerId: customer.id, channel: Channel.SMS, priority: TicketPriority.MEDIUM, status: TicketStatus.OPEN, firstResponseDueAt: sla ? addMinutes(input.receivedAt, sla.firstResponseMinutes) : null, resolutionDueAt: sla ? addMinutes(input.receivedAt, sla.resolutionMinutes) : null }, select: { id: true, status: true, subject: true, assignedAgentId: true, teamId: true } });
      await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: null, action: "TICKET_CREATED", newValue: TicketStatus.OPEN } });
    }
    const message = await tx.ticketMessage.create({ data: { ticketId: ticket.id, authorUserId: author.id, body: input.text, externalId: input.externalId, createdAt: input.receivedAt }, select: { id: true } });
    if (!created && ticket.status === TicketStatus.WAITING_CUSTOMER) {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.IN_PROGRESS } });
      await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: null, action: "STATUS_CHANGED", oldValue: TicketStatus.WAITING_CUSTOMER, newValue: TicketStatus.IN_PROGRESS } });
    }
    // Shared CUSTOMER_REPLY targeting (same rule for every channel): assigned
    // agent + ONLY this ticket's team manager (Ticket.teamId) + watchers, with
    // an ADMIN fallback only for an unrouted/unassigned/unwatched ticket.
    const recipients = await customerReplyNotificationRecipientIds(tx, { ticketId: ticket.id, teamId: ticket.teamId, assignedAgentId: ticket.assignedAgentId });
    await createNotifications(tx, recipients, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${ticket.id}: ${ticket.subject}`, ticket.id);
    return { status: created ? "TICKET_CREATED" as const : "MESSAGE_APPENDED" as const, ticketId: ticket.id, messageId: message.id, assignedAgentId: ticket.assignedAgentId, customerId: customer.id, teamId: ticket.teamId };
  }).catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "DUPLICATE" as const };
    throw error;
  });
  if (outcome.status !== "DUPLICATE") emitTicketMessageCreated({ ticketId: outcome.ticketId, messageId: outcome.messageId, assignedAgentId: outcome.assignedAgentId, customerId: outcome.customerId, teamId: outcome.teamId, visibility: "public" });
  return outcome;
 });
}
