import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../../audit-logs/audit-log.service.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { customerReplyNotificationRecipientIds } from "../../../shared/team/team-scope.js";
import { getSendConfig } from "./whatsapp.config.js";
import { whatsappClient, WhatsappApiError } from "./whatsapp.client.js";
import type { InboundResult, InboundTextMessage } from "./whatsapp.types.js";
import { normalizePhoneNumber } from "../../../shared/utils/phone.js";
import { resolveCustomerByPhone } from "../../customers/resolve-customer-by-phone.js";
import { createCanonicalTicket } from "../../tickets/create-canonical-ticket.js";
import {
  claimDeliveryForAttempt,
  recordDeliveryOutcome,
  recordOutboundDeliveryFailure,
  skippedClaimResult,
  type OutboundDeliveryFailureReason,
  type OutboundDeliveryResult,
} from "../outbound-delivery.js";

/**
 * Adapter between the WhatsApp Cloud API and the existing CRM
 * customer / ticket / conversation / notification services.
 *
 * No ticket business logic is re-implemented here beyond what the Portal
 * customer-reply path already does (portal.service.ts) — a new inbound message
 * either appends to the customer's active WhatsApp ticket or opens a new one.
 */

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
export type MatchOrCreateCustomerResult =
  | { kind: "customer"; customer: { id: string } }
  | { kind: "ambiguous"; candidateCount: number; correlationId: string };

/**
 * CONV-027 (OD-CC-6, CC-GAP-21): phone resolution now goes through the shared
 * `resolveCustomerByPhone` (CONV-015) instead of WhatsApp's own ordered-match-
 * and-take-newest logic. Ambiguity stops automatic resolution entirely — no
 * customer is chosen, and the caller must not proceed to any ticket/message
 * write.
 */
async function matchOrCreateCustomer(
  tx: Prisma.TransactionClient,
  from: string,
  profileName: string | null,
): Promise<MatchOrCreateCustomerResult> {
  const digits = from.replace(/\D/g, "");
  const e164 = toE164(from);
  const resolved = await resolveCustomerByPhone(tx, from, { id: true });
  if (resolved.kind === "one") return { kind: "customer", customer: resolved.customer };
  if (resolved.kind === "ambiguous") {
    console.warn(`whatsapp: ambiguous phone match — correlationId=${resolved.correlationId} channel=WHATSAPP count=${resolved.candidateCount}`);
    return { kind: "ambiguous", candidateCount: resolved.candidateCount, correlationId: resolved.correlationId };
  }

  // `none` — existing deterministic placeholder-email fallback, unchanged.
  const email = `wa-${digits}@no-email.invalid`;
  const existingByEmail = await tx.customer.findUnique({ where: { email }, select: { id: true } });
  if (existingByEmail) return { kind: "customer", customer: existingByEmail };
  const name = profileName?.trim() || e164;
  const created = await tx.customer.create({
    data: { name, email, phone: e164 },
    select: { id: true },
  });
  await createAuditLog({
    actorId: null,
    action: AUDIT_ACTIONS.CUSTOMER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: created.id,
    changes: { name: { to: name }, email: { to: email }, phone: { to: e164 } },
  }, tx);
  return { kind: "customer", customer: created };
}

async function createWhatsappTicket(
  tx: Prisma.TransactionClient,
  customerId: string,
  firstText: string,
  now: Date,
) {
  const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
  // Inbound WhatsApp tickets have no Team at creation (teamId null), so automatic
  // assignment does not run here — the ticket waits for ADMIN routing, then the
  // canonical ticket update flow auto-assigns it once a Team is set.
  const canonical = await createCanonicalTicket({
    tx,
    data: {
      subject: deriveSubject(firstText),
      description: firstText,
      customerId,
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      channel: Channel.WHATSAPP,
      assignedAgentId: null,
      createdAt: now,
      firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
      resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
    },
    actorId: null,
  });
  return canonical.ticket;
}

async function fanOutInboundNotification(
  tx: Prisma.TransactionClient,
  ticket: { id: string; subject: string; assignedAgentId: string | null },
) {
  // Shared CUSTOMER_REPLY targeting (same rule for every channel): assigned
  // agent + ONLY this ticket's team manager (Ticket.teamId) + watchers. No
  // global ADMIN fan-out — admins are reached only as watchers or via the
  // unrouted/unassigned/unwatched fallback (a brand-new inbound ticket).
  const teamRow = await tx.ticket.findUnique({ where: { id: ticket.id }, select: { teamId: true } });
  const recipientIds = await customerReplyNotificationRecipientIds(tx, {
    ticketId: ticket.id,
    teamId: teamRow?.teamId ?? null,
    assignedAgentId: ticket.assignedAgentId,
  });
  await createNotifications(
    tx,
    recipientIds,
    "CUSTOMER_REPLY",
    "Customer replied",
    `Customer replied to ticket #${ticket.id}: ${ticket.subject}`,
    ticket.id,
  );
  // CONV-020 (CC-GAP-02 fix): callers need this to assemble the complete
  // realtime audience — omitting teamId silently drops the event for the
  // ticket's own-team Manager/Agent subscribers on an already-routed ticket.
  return teamRow?.teamId ?? null;
}

/**
 * Process one inbound WhatsApp text message. Idempotent: a repeated webhook
 * delivery of the same provider message id makes no further writes.
 */
export async function processInboundTextMessage(message: InboundTextMessage): Promise<InboundResult> {
  return withRealtimeOutbox(async () => {
   const { outcome, assignedAgentId, customerId, teamId } = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.ticketMessage.findUnique({
      where: { externalId: message.externalId },
      select: { id: true },
    });
    if (duplicate) return { outcome: { status: "DUPLICATE" } as InboundResult, assignedAgentId: null, customerId: null, teamId: null };

    const author = await ensureSystemUser(tx);
    const matched = await matchOrCreateCustomer(tx, message.from, message.profileName);
    if (matched.kind === "ambiguous") {
      // CONV-027: stop automatic resolution entirely — no customer/ticket/
      // message write, safe acknowledged outcome (200, not an error the
      // provider would retry-storm on).
      return { outcome: { status: "AMBIGUOUS" } as InboundResult, assignedAgentId: null, customerId: null, teamId: null };
    }
    const customer = matched.customer;

    // CONV-025 (OD-CC-4): Meta's webhook payload for text messages exposes no
    // reliable thread/message correlation beyond phone identity, so every
    // inbound WhatsApp message without a stronger signal creates a new ticket
    // — never the "newest active WhatsApp ticket" heuristic. This also
    // trivially satisfies OD-CC-3 (never reopen RESOLVED from identity/phone
    // matching): there is no lookup to reopen.
    const now = new Date();
    const ticket = await createWhatsappTicket(tx, customer.id, message.text, now);

    let record: { id: string };
    try {
      record = await tx.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: author.id,
          body: message.text,
          externalId: message.externalId,
          createdAt: messageTimestamp(message.timestamp, now),
          contentFormat: "PLAIN_TEXT",
          contentSource: "WHATSAPP",
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return { outcome: { status: "DUPLICATE" } as InboundResult, assignedAgentId: ticket.assignedAgentId, customerId: customer.id, teamId: null };
      throw error;
    }

    const resolvedTeamId = await fanOutInboundNotification(tx, ticket);

    return {
      outcome: {
        status: "TICKET_CREATED",
        ticketId: ticket.id,
        messageId: record.id,
      } as InboundResult,
      assignedAgentId: ticket.assignedAgentId,
      customerId: customer.id,
      teamId: resolvedTeamId,
    };
   });

   if (outcome.status !== "DUPLICATE" && outcome.ticketId && outcome.messageId) {
     emitTicketMessageCreated({
       ticketId: outcome.ticketId,
       messageId: outcome.messageId,
       assignedAgentId,
       customerId,
       teamId,
       visibility: "public",
     });
   }
   return outcome;
  });
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

  if (!getSendConfig()) {
    await recordDeliveryOutcome(messageId, { status: "FAILED", errorCode: "INTEGRATION_NOT_CONFIGURED", terminal: true });
    return recordOutboundDeliveryFailure({ channel: "WHATSAPP", ticketId, reason: "INTEGRATION_NOT_CONFIGURED" });
  }
  if (!to || !to.replace(/\D/g, "")) {
    await recordDeliveryOutcome(messageId, { status: "FAILED", errorCode: "NO_RECIPIENT_PHONE", terminal: true });
    return recordOutboundDeliveryFailure({ channel: "WHATSAPP", ticketId, reason: "NO_RECIPIENT_PHONE" });
  }

  // CONV-037/038: claim the durable delivery row for this attempt; a lost
  // claim (already leased/terminal) skips the provider call entirely.
  const claimed = await claimDeliveryForAttempt(messageId);
  if (!claimed) return (await skippedClaimResult("WHATSAPP", messageId)) as OutboundDeliveryResult;
  try {
    const { messageId: providerId } = await whatsappClient.sendTextMessage({ to, text });
    // CONV-037: MessageDelivery.providerMessageId is now the source of truth —
    // TicketMessage.externalId is no longer written for new outbound sends.
    await recordDeliveryOutcome(messageId, { status: "SENT", providerMessageId: providerId })
      .catch((error) => console.error("whatsapp: sent message but could not record delivery outcome", error));
    return { channel: "WHATSAPP", status: "SENT", externalId: providerId };
  } catch (error) {
    const reason: OutboundDeliveryFailureReason =
      error instanceof WhatsappApiError && !error.rejected ? "PROVIDER_UNREACHABLE" : "PROVIDER_REJECTED";
    await recordDeliveryOutcome(messageId, { status: "FAILED", errorCode: reason, errorMessage: error instanceof Error ? error.message : undefined });
    return recordOutboundDeliveryFailure({ channel: "WHATSAPP", ticketId, reason });
  }
}

export const whatsappInternals = { toE164, deriveSubject, SYSTEM_USER_EMAIL };
