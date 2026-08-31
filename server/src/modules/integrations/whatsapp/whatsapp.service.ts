import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { getSendConfig } from "./whatsapp.config.js";
import { whatsappClient, WhatsappApiError } from "./whatsapp.client.js";
import type {
  InboundResult,
  InboundTextMessage,
  OutboundDeliveryResult,
  OutboundFailureReason,
} from "./whatsapp.types.js";
import { normalizePhoneNumber } from "../../../shared/utils/phone.js";

/**
 * Adapter between the WhatsApp Cloud API and the existing CRM
 * customer / ticket / conversation / notification services.
 *
 * No ticket business logic is re-implemented here beyond what the Portal
 * customer-reply path already does (portal.service.ts) — a new inbound message
 * either appends to the customer's active WhatsApp ticket or opens a new one.
 */

// Non-terminal statuses — an incoming message joins one of these, otherwise a new ticket opens.
const ACTIVE_TICKET_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;

// Login-less identity used as the author of every inbound WhatsApp TicketMessage.
// TicketMessage.authorUserId is a required FK; WhatsApp senders usually have no User.
const SYSTEM_USER_EMAIL = "whatsapp-inbound@system.invalid";
const SYSTEM_USER_NAME = "WhatsApp Customer";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Digits-only, "+"-prefixed E.164-ish form used for storage and matching. */
function toE164(raw: string): string {
  return normalizePhoneNumber(raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`) ?? `+${raw.replace(/\D/g, "")}`;
}

/** Deterministic, user-friendly ticket subject derived from the first message. */
function deriveSubject(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  const clipped = collapsed.length > 60 ? `${collapsed.slice(0, 57).trimEnd()}…` : collapsed;
  return `WhatsApp: ${clipped}`;
}

/** Trust the provider timestamp only when it is a sane past instant. */
function messageTimestamp(unixSeconds: number, fallback: Date): Date {
  const ms = unixSeconds * 1000;
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + 60_000) return fallback;
  return new Date(ms);
}

async function ensureSystemUser(tx: Prisma.TransactionClient) {
  const existing = await tx.user.findFirst({ where: { email: SYSTEM_USER_EMAIL }, select: { id: true } });
  if (existing) return existing;
  return tx.user.create({
    data: {
      name: SYSTEM_USER_NAME,
      email: SYSTEM_USER_EMAIL,
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      role: Role.CUSTOMER,
      isActive: false,
    },
    select: { id: true },
  });
}

/**
 * Match an existing customer by phone, or create one from WhatsApp profile data.
 *
 * - Exactly one phone match → reuse it.
 * - Multiple matches → deterministically pick the most recently updated and log
 *   a warning. Records are never merged.
 * - No match → create a customer. `Customer.email` is a required unique column
 *   and WhatsApp provides no email, so a non-routable `.invalid` placeholder is
 *   stored (see ADR-030) — it is a schema-compatibility key, not contact data.
 */
async function matchOrCreateCustomer(
  tx: Prisma.TransactionClient,
  from: string,
  profileName: string | null,
) {
  const digits = from.replace(/\D/g, "");
  const e164 = toE164(from);
  const matches = await tx.customer.findMany({
    where: { OR: [{ phone: e164 }, { phone: digits }, { phone: from }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    console.warn(`whatsapp: ${matches.length} customers match the sender phone; routing to the most recently updated`);
    return matches[0]!;
  }

  const email = `wa-${digits}@no-email.invalid`;
  const existingByEmail = await tx.customer.findUnique({ where: { email }, select: { id: true } });
  if (existingByEmail) return existingByEmail;
  return tx.customer.create({
    data: { name: profileName?.trim() || e164, email, phone: e164 },
    select: { id: true },
  });
}

async function createWhatsappTicket(
  tx: Prisma.TransactionClient,
  customerId: string,
  firstText: string,
  now: Date,
) {
  const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
  const ticket = await tx.ticket.create({
    data: {
      subject: deriveSubject(firstText),
      description: firstText,
      customerId,
      status: TicketStatus.NEW,
      priority: TicketPriority.MEDIUM,
      channel: Channel.WHATSAPP,
      assignedAgentId: null,
      createdAt: now,
      firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
      resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
    },
    select: { id: true, status: true, subject: true, assignedAgentId: true },
  });
  await tx.ticketHistory.create({
    data: { ticketId: ticket.id, actorUserId: null, action: "TICKET_CREATED", newValue: TicketStatus.NEW },
  });
  return ticket;
}

async function fanOutInboundNotification(
  tx: Prisma.TransactionClient,
  ticket: { id: string; subject: string; assignedAgentId: string | null },
) {
  const recipientIds: string[] = [];
  if (ticket.assignedAgentId) {
    const agent = await tx.user.findFirst({ where: { id: ticket.assignedAgentId, isActive: true }, select: { id: true } });
    if (agent) recipientIds.push(agent.id);
  }
  const adminsManagers = await tx.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
    select: { id: true },
  });
  for (const user of adminsManagers) recipientIds.push(user.id);
  await createNotifications(
    tx,
    recipientIds,
    "CUSTOMER_REPLY",
    "Customer replied",
    `Customer replied to ticket #${ticket.id}: ${ticket.subject}`,
    ticket.id,
  );
}

/**
 * Process one inbound WhatsApp text message. Idempotent: a repeated webhook
 * delivery of the same provider message id makes no further writes.
 */
export async function processInboundTextMessage(message: InboundTextMessage): Promise<InboundResult> {
  return withRealtimeOutbox(async () => {
   const { outcome, assignedAgentId, customerId } = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.ticketMessage.findUnique({
      where: { externalId: message.externalId },
      select: { id: true },
    });
    if (duplicate) return { outcome: { status: "DUPLICATE" } as InboundResult, assignedAgentId: null, customerId: null };

    const author = await ensureSystemUser(tx);
    const customer = await matchOrCreateCustomer(tx, message.from, message.profileName);

    const activeTicket = await tx.ticket.findFirst({
      where: { customerId: customer.id, channel: Channel.WHATSAPP, status: { in: [...ACTIVE_TICKET_STATUSES] } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: { id: true, status: true, subject: true, assignedAgentId: true },
    });

    const now = new Date();
    const ticket = activeTicket ?? (await createWhatsappTicket(tx, customer.id, message.text, now));
    const createdTicket = !activeTicket;

    let record: { id: string };
    try {
      record = await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: author.id,
          body: message.text,
          externalId: message.externalId,
          createdAt: messageTimestamp(message.timestamp, now),
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return { outcome: { status: "DUPLICATE" } as InboundResult, assignedAgentId: ticket.assignedAgentId, customerId: customer.id };
      throw error;
    }

    // Mirror the Portal customer-reply behaviour: a reply while WAITING_CUSTOMER
    // moves the ticket back to IN_PROGRESS. RESOLVED/CLOSED never match the
    // active filter above, so a message after resolution opens a fresh ticket.
    if (!createdTicket && ticket.status === TicketStatus.WAITING_CUSTOMER) {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.IN_PROGRESS } });
      await tx.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorUserId: null,
          action: "STATUS_CHANGED",
          oldValue: TicketStatus.WAITING_CUSTOMER,
          newValue: TicketStatus.IN_PROGRESS,
        },
      });
    }

    await fanOutInboundNotification(tx, ticket);

    return {
      outcome: {
        status: createdTicket ? "TICKET_CREATED" : "MESSAGE_APPENDED",
        ticketId: ticket.id,
        messageId: record.id,
      } as InboundResult,
      assignedAgentId: ticket.assignedAgentId,
      customerId: customer.id,
    };
   });

   if (outcome.status !== "DUPLICATE" && outcome.ticketId && outcome.messageId) {
     emitTicketMessageCreated({
       ticketId: outcome.ticketId,
       messageId: outcome.messageId,
       assignedAgentId,
       customerId,
       visibility: "public",
     });
   }
   return outcome;
  });
}

async function recordDeliveryFailure(
  ticketId: string,
  reason: OutboundFailureReason,
): Promise<OutboundDeliveryResult> {
  try {
    await prisma.ticketHistory.create({
      data: { ticketId, actorUserId: null, action: "WHATSAPP_DELIVERY_FAILED", newValue: reason },
    });
  } catch (error) {
    console.error("whatsapp: failed to record delivery failure", error);
  }
  return { channel: "WHATSAPP", status: "FAILED", reason };
}

/**
 * Send an already-persisted staff reply to the customer over WhatsApp.
 *
 * The TicketMessage is created and committed by the ticket service before this
 * runs, so a send failure never rolls back the conversation. Failures are
 * returned to the caller AND recorded as a `WHATSAPP_DELIVERY_FAILED` ticket
 * history row so they remain visible after a reload.
 */
export async function deliverOutboundReply(params: {
  ticketId: string;
  messageId: string;
  to: string | null;
  text: string;
}): Promise<OutboundDeliveryResult> {
  const { ticketId, messageId, to, text } = params;

  if (!getSendConfig()) return recordDeliveryFailure(ticketId, "INTEGRATION_NOT_CONFIGURED");
  if (!to || !to.replace(/\D/g, "")) return recordDeliveryFailure(ticketId, "NO_RECIPIENT_PHONE");

  try {
    const { messageId: providerId } = await whatsappClient.sendTextMessage({ to, text });
    await prisma.ticketMessage
      .update({ where: { id: messageId }, data: { externalId: providerId } })
      .catch((error) => console.error("whatsapp: sent message but could not store provider id", error));
    return { channel: "WHATSAPP", status: "SENT", externalId: providerId };
  } catch (error) {
    const reason: OutboundFailureReason =
      error instanceof WhatsappApiError && !error.rejected ? "PROVIDER_UNREACHABLE" : "PROVIDER_REJECTED";
    return recordDeliveryFailure(ticketId, reason);
  }
}

export const whatsappInternals = { toE164, deriveSubject, SYSTEM_USER_EMAIL };
