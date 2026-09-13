import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../../audit-logs/audit-log.service.js";
import { emailSchema } from "../../../shared/validation/common.schema.js";
import { replyHtmlToPlainText, sanitizeReplyHtml } from "../../../shared/rich-text/reply-html.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { customerReplyNotificationRecipientIds } from "../../../shared/team/team-scope.js";
import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment.constants.js";
import { detectFileType } from "../../attachments/detect-file-type.js";
import { sanitizeFileName } from "../../attachments/file-name.js";
import { getAttachmentStorage, StorageUnavailableError } from "../../attachments/attachment-storage.js";
import { requireInboundEmailConfig, requireOutboundEmailConfig } from "./email.config.js";
import { emailClient, ResendEmailError } from "./email.client.js";
import { createCanonicalTicket } from "../../tickets/create-canonical-ticket.js";
import type { EmailDeliveryResult, InboundEmailEvent, ReceivedEmail } from "./email.types.js";
import {
  type OutboundDeliveryResult,
  outboundFailureReason,
  recordOutboundDeliveryFailure,
  claimDeliveryForAttempt,
  recordDeliveryOutcome,
  skippedClaimResult,
} from "../outbound-delivery.js";

const SYSTEM_USER_EMAIL = "email-inbound@system.invalid";
const SYSTEM_USER_NAME = "Email Customer";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function ticketReference(id: string) {
  return id.slice(-8).toUpperCase();
}

function emailSubject(ticket: { id: string; subject: string }) {
  return `[CRM-${ticketReference(ticket.id)}] ${ticket.subject}`;
}

function threadAddress(base: string, token: string) {
  const at = base.lastIndexOf("@");
  return at > 0 ? `${base.slice(0, at)}+${token}${base.slice(at)}` : base;
}

function header(headers: Record<string, string>, name: string): string | null {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? headers[key] ?? null : null;
}

function messageIds(value: string | null): string[] {
  if (!value) return [];
  const bracketed = value.match(/<[^<>\r\n]{1,996}>/g);
  return [...new Set(bracketed?.length ? bracketed : value.split(/\s+/).filter(Boolean))].slice(0, 100);
}

function normalizeInboundBody(email: ReceivedEmail): string {
  const plain = email.text?.replace(/\r\n/g, "\n").trim();
  if (plain) return plain.slice(0, 20_000);
  const safeHtml = email.html ? sanitizeReplyHtml(email.html) : "";
  return replyHtmlToPlainText(safeHtml).trim().slice(0, 20_000);
}

function senderName(headers: Record<string, string>, fallback: string): string {
  const raw = header(headers, "from");
  const match = raw?.match(/^\s*"?([^"<]{1,200})"?\s*<[^>]+>\s*$/);
  return (match?.[1]?.trim() || fallback.split("@")[0] || "Email Customer").slice(0, 200);
}

function normalizedSender(raw: string): string {
  const candidate = raw.match(/<([^<>]+)>/)?.[1] ?? raw;
  const result = emailSchema.safeParse(candidate);
  if (!result.success) throw new AppError(422, "INVALID_EMAIL_SENDER", "Inbound sender email is invalid");
  return result.data;
}

async function ensureSystemUser(tx: Prisma.TransactionClient) {
  const existing = await tx.user.findUnique({ where: { email: SYSTEM_USER_EMAIL }, select: { id: true } });
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

async function matchOrCreateCustomer(tx: Prisma.TransactionClient, email: string, name: string) {
  const existing = await tx.customer.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;
  const created = await tx.customer.create({ data: { name, email }, select: { id: true } });
  await createAuditLog({
    actorId: null,
    action: AUDIT_ACTIONS.CUSTOMER_CREATED,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: created.id,
    changes: { name: { to: name }, email: { to: email } },
  }, tx);
  return created;
}

async function createEmailTicket(
  tx: Prisma.TransactionClient,
  customerId: string,
  subject: string,
  body: string,
  now: Date,
) {
  const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
  // Inbound email tickets have no Team at creation (teamId null), so automatic
  // assignment does not run here — the ticket waits for ADMIN routing, then the
  // canonical ticket update flow auto-assigns it once a Team is set.
  const canonical = await createCanonicalTicket({
    tx,
    data: {
      subject: (subject.trim() || "Email support request").slice(0, 200),
      description: body,
      customerId,
      channel: Channel.EMAIL,
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      emailThreadToken: randomBytes(18).toString("base64url"),
      createdAt: now,
      firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
      resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
    },
    actorId: null,
    select: { emailThreadToken: true },
  });
  return canonical.ticket;
}

async function correlateTicket(
  tx: Prisma.TransactionClient,
  customerId: string,
  email: ReceivedEmail,
  inboundAddress: string,
) {
  const references = [...messageIds(header(email.headers, "in-reply-to")), ...messageIds(header(email.headers, "references"))];
  if (references.length) {
    const referenced = await tx.ticketMessage.findFirst({
      where: {
        externalMessageId: { in: references },
        ticket: { customerId, channel: Channel.EMAIL },
      },
      orderBy: { createdAt: "desc" },
      select: { ticket: { select: { id: true, status: true, subject: true, assignedAgentId: true, emailThreadToken: true } } },
    });
    if (referenced) return referenced.ticket;
  }

  const [baseLocal, baseDomain] = inboundAddress.toLowerCase().split("@");
  const token = email.to
    .map((value) => value.toLowerCase())
    .find((value) => value.startsWith(`${baseLocal}+`) && value.endsWith(`@${baseDomain}`))
    ?.slice(baseLocal!.length + 1, -(baseDomain!.length + 1));
  if (token) {
    const ticket = await tx.ticket.findFirst({
      where: { emailThreadToken: token, customerId, channel: Channel.EMAIL },
      select: { id: true, status: true, subject: true, assignedAgentId: true, emailThreadToken: true },
    });
    if (ticket) return ticket;
  }

  const reference = email.subject.match(/\[CRM-([A-Z0-9]{8})\]/i)?.[1]?.toUpperCase();
  if (reference) {
    const candidates = await tx.ticket.findMany({
      where: { customerId, channel: Channel.EMAIL, id: { endsWith: reference.toLowerCase() } },
      take: 2,
      select: { id: true, status: true, subject: true, assignedAgentId: true, emailThreadToken: true },
    });
    if (candidates.length === 1) return candidates[0]!;
  }

  // CONV-023 (OD-CC-4): no "exactly one active EMAIL ticket" identity-only
  // fallback. Absent thread/token/reference evidence, the caller always
  // creates a new ticket — customer identity alone never selects one.
  return null;
}

async function notifyInbound(
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
  // CONV-019 (CC-GAP-01 fix): callers need this to assemble the complete
  // realtime audience — omitting teamId silently drops the event for the
  // ticket's own-team Manager/Agent subscribers on an already-routed ticket.
  return teamRow?.teamId ?? null;
}

type PreparedAttachment = { externalId: string; storageKey: string; fileName: string; mimeType: string; body: Buffer };

async function prepareAttachments(config: { apiKey: string }, email: ReceivedEmail): Promise<PreparedAttachment[]> {
  const prepared: PreparedAttachment[] = [];
  for (const attachment of email.attachments) {
    if (attachment.size <= 0 || attachment.size > MAX_ATTACHMENT_BYTES) {
      console.warn(`email: skipped attachment ${attachment.id} because its size is outside the CRM limit`);
      continue;
    }
    const body = await emailClient.downloadReceivedAttachment(config.apiKey, email.id, attachment.id, MAX_ATTACHMENT_BYTES);
    if (body.length > MAX_ATTACHMENT_BYTES) {
      console.warn(`email: skipped attachment ${attachment.id} because downloaded bytes exceed the CRM limit`);
      continue;
    }
    const mimeType = detectFileType(body);
    if (!mimeType) {
      console.warn(`email: skipped attachment ${attachment.id} because its content type is not allowed`);
      continue;
    }
    prepared.push({
      externalId: `resend:${email.id}:${attachment.id}`,
      storageKey: `attachments/email/${randomUUID()}`,
      fileName: sanitizeFileName(attachment.filename),
      mimeType,
      body,
    });
  }
  return prepared;
}

export async function processInboundEmail(event: InboundEmailEvent) {
  const config = requireInboundEmailConfig();
  const duplicate = await prisma.ticketMessage.findUnique({ where: { externalId: `resend:${event.emailId}` }, select: { id: true } });
  if (duplicate) return { status: "DUPLICATE" as const };

  let email: ReceivedEmail;
  try {
    email = await emailClient.retrieveReceivedEmail(config.apiKey, event.emailId);
  } catch (error) {
    console.error(`email: failed to retrieve inbound email ${event.emailId}`, error instanceof Error ? error.message : error);
    throw new AppError(502, "EMAIL_PROVIDER_UNAVAILABLE", "Inbound email content could not be retrieved");
  }
  const sender = normalizedSender(email.from);
  const body = normalizeInboundBody(email);
  if (!body) throw new AppError(422, "EMPTY_EMAIL", "Inbound email has no supported message body");
  const prepared = await prepareAttachments(config, email);

  let storage: Awaited<ReturnType<typeof getAttachmentStorage>> | null = null;
  if (prepared.length) {
    try {
      storage = await getAttachmentStorage();
      for (const attachment of prepared) await storage.put(attachment.storageKey, attachment.body, { contentType: attachment.mimeType });
    } catch (error) {
      for (const attachment of prepared) await storage?.remove(attachment.storageKey).catch(() => undefined);
      if (error instanceof StorageUnavailableError) {
        throw new AppError(503, "STORAGE_UNAVAILABLE", "Attachment storage is currently unavailable");
      }
      throw new AppError(502, "EMAIL_ATTACHMENT_FAILED", "Inbound email attachments could not be stored");
    }
  }

  const messageId = randomUUID();
  return withRealtimeOutbox(async () => {
   try {
    const outcome = await prisma.$transaction(async (tx) => {
      const raced = await tx.ticketMessage.findUnique({ where: { externalId: `resend:${event.emailId}` }, select: { id: true } });
      if (raced) return { status: "DUPLICATE" as const };
      const author = await ensureSystemUser(tx);
      const customer = await matchOrCreateCustomer(tx, sender, senderName(email.headers, sender));
      let ticket = await correlateTicket(tx, customer.id, email, config.inboundAddress);
      if (ticket?.status === TicketStatus.CLOSED) ticket = null;
      const createdTicket = !ticket;
      ticket ??= await createEmailTicket(tx, customer.id, email.subject, body, new Date(email.createdAt));

      await tx.ticketMessage.create({
        data: {
          id: messageId,
          ticketId: ticket.id,
          authorUserId: author.id,
          body,
          externalId: `resend:${event.emailId}`,
          externalMessageId: email.messageId,
          createdAt: new Date(email.createdAt),
          contentFormat: "PLAIN_TEXT",
          contentSource: "EMAIL",
        },
      });
      if (prepared.length) {
        await tx.attachment.createMany({
          data: prepared.map((attachment) => ({
            ticketId: ticket!.id,
            messageId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            storageKey: attachment.storageKey,
            externalId: attachment.externalId,
          })),
        });
      }

      if (!createdTicket && ticket.status === TicketStatus.WAITING_CUSTOMER) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.IN_PROGRESS } });
        await tx.ticketHistory.create({
          data: { ticketId: ticket.id, actorUserId: null, action: "STATUS_CHANGED", oldValue: ticket.status, newValue: TicketStatus.IN_PROGRESS },
        });
      } else if (!createdTicket && ticket.status === TicketStatus.RESOLVED) {
        await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.OPEN, resolvedAt: null } });
        await tx.ticketHistory.create({
          data: { ticketId: ticket.id, actorUserId: null, action: "STATUS_CHANGED", oldValue: ticket.status, newValue: TicketStatus.OPEN },
        });
      }
      const teamId = await notifyInbound(tx, ticket);
      return {
        status: createdTicket ? "TICKET_CREATED" as const : "MESSAGE_APPENDED" as const,
        ticketId: ticket.id,
        messageId,
        assignedAgentId: ticket.assignedAgentId,
        customerId: customer.id,
        teamId,
      };
    });
    // Committed — tell connected staff (and the owning portal customer). Rolled-back
    // / duplicate paths never reach here.
    if (outcome.status === "DUPLICATE") return outcome;
    emitTicketMessageCreated({
      ticketId: outcome.ticketId,
      messageId: outcome.messageId,
      assignedAgentId: outcome.assignedAgentId,
      customerId: outcome.customerId,
      teamId: outcome.teamId,
      visibility: "public",
    });
    return { status: outcome.status, ticketId: outcome.ticketId, messageId: outcome.messageId };
   } catch (error) {
    for (const attachment of prepared) await storage?.remove(attachment.storageKey).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { status: "DUPLICATE" as const };
    throw error;
   }
  });
}

export async function deliverEmailReply(params: {
  ticketId: string;
  messageId: string;
  recipient: string;
  subject: string;
  body: string;
  threadToken: string;
  inReplyTo: string | null;
  references: string[];
}): Promise<EmailDeliveryResult> {
  const config = requireOutboundEmailConfig();
  const recipient = emailSchema.safeParse(params.recipient);
  if (!recipient.success) throw new AppError(422, "EMAIL_RECIPIENT_INVALID", "Ticket customer does not have a valid email address");
  try {
    const result = await emailClient.sendTicketEmail({
      apiKey: config.apiKey,
      from: config.from,
      to: recipient.data,
      subject: emailSubject({ id: params.ticketId, subject: params.subject }),
      html: params.body,
      text: replyHtmlToPlainText(params.body),
      replyTo: config.inboundAddress ? threadAddress(config.inboundAddress, params.threadToken) : null,
      inReplyTo: params.inReplyTo,
      references: params.references,
      idempotencyKey: `crm-ticket-message-${params.messageId}`,
    });
    return { channel: "EMAIL", status: "SENT", externalId: `resend:${result.emailId}` };
  } catch (error) {
    const timedOut = error instanceof ResendEmailError && error.operation === "timeout";
    console.error(`email: outbound send failed ticket=${params.ticketId} operation=${error instanceof ResendEmailError ? error.operation : "send"}`);
    // A timeout / aborted request is a "could not reach the provider" condition,
    // not a provider rejection — `outboundFailureReason` maps EMAIL_DELIVERY_TIMEOUT
    // to PROVIDER_UNREACHABLE, keeping it distinct from EMAIL_DELIVERY_FAILED
    // (PROVIDER_REJECTED). The reply is already committed either way.
    if (timedOut) {
      throw new AppError(504, "EMAIL_DELIVERY_TIMEOUT", "Resend did not respond within the outbound delivery timeout");
    }
    throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Resend rejected or could not deliver the email reply");
  }
}

/**
 * Deliver an already-persisted staff reply to the customer over email.
 *
 * The `TicketMessage` and its transactional side effects are committed by the
 * ticket service BEFORE this runs (mirrors the WhatsApp seam), so a provider or
 * configuration failure never rolls back the conversation. Failures are returned
 * to the caller as `{ status: "FAILED", reason }` and recorded as an
 * `EMAIL_DELIVERY_FAILED` ticket-history row. On success the Resend email id is
 * written onto the committed row in a second, best-effort update — a failure of
 * that write is logged and never deletes the reply.
 */
export async function deliverOutboundEmailReply(params: {
  ticketId: string;
  messageId: string;
  recipient: string | null;
  subject: string;
  body: string;
  threadToken: string;
  inReplyTo: string | null;
  references: string[];
}): Promise<OutboundDeliveryResult> {
  if (!params.recipient) {
    await recordDeliveryOutcome(params.messageId, { status: "FAILED", errorCode: "NO_RECIPIENT_EMAIL", terminal: true });
    return recordOutboundDeliveryFailure({ channel: "EMAIL", ticketId: params.ticketId, reason: "NO_RECIPIENT_EMAIL" });
  }
  // CONV-037/038: claim the durable delivery row for this attempt. A `null`
  // claim means it is already leased/terminal (an overlapping sweep call, or
  // this row is already SENT/DELIVERED/FAILED) — skip the provider call
  // entirely so two overlapping invocations never both send.
  const claimed = await claimDeliveryForAttempt(params.messageId);
  if (!claimed) return skippedClaimResult("EMAIL", params.messageId);
  let result: EmailDeliveryResult;
  try {
    result = await deliverEmailReply({
      ticketId: params.ticketId,
      messageId: params.messageId,
      recipient: params.recipient,
      subject: params.subject,
      body: params.body,
      threadToken: params.threadToken,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });
  } catch (error) {
    const reason = outboundFailureReason(error);
    await recordDeliveryOutcome(params.messageId, { status: "FAILED", errorCode: reason, errorMessage: error instanceof Error ? error.message : undefined });
    return recordOutboundDeliveryFailure({ channel: "EMAIL", ticketId: params.ticketId, reason });
  }
  // CONV-037: the durable MessageDelivery row is now the source of truth for
  // provider id/status — TicketMessage.externalId is no longer written for
  // new outbound sends (it stays populated only for historical/inbound rows).
  // A bookkeeping failure here must never turn an actually-sent email into a
  // lost reply — log and still report SENT, mirroring the prior best-effort
  // externalId-write behavior.
  await recordDeliveryOutcome(params.messageId, { status: "SENT", providerMessageId: result.externalId })
    .catch((error) => console.error("email: sent reply but could not record delivery outcome", error));
  return { channel: "EMAIL", status: "SENT", externalId: result.externalId };
}

export const emailInternals = { emailSubject, threadAddress, messageIds, normalizeInboundBody, SYSTEM_USER_EMAIL };
