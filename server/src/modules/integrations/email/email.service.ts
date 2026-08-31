import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { emailSchema } from "../../../shared/validation/common.schema.js";
import { replyHtmlToPlainText, sanitizeReplyHtml } from "../../../shared/rich-text/reply-html.js";
import { createNotifications } from "../../notifications/notification.service.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../../realtime/realtime.publisher.js";
import { MAX_ATTACHMENT_BYTES } from "../../attachments/attachment.constants.js";
import { detectFileType } from "../../attachments/detect-file-type.js";
import { sanitizeFileName } from "../../attachments/file-name.js";
import { getAttachmentStorage, StorageUnavailableError } from "../../attachments/attachment-storage.js";
import { requireInboundEmailConfig, requireOutboundEmailConfig } from "./email.config.js";
import { emailClient, ResendEmailError } from "./email.client.js";
import type { EmailDeliveryResult, InboundEmailEvent, ReceivedEmail } from "./email.types.js";

const SYSTEM_USER_EMAIL = "email-inbound@system.invalid";
const SYSTEM_USER_NAME = "Email Customer";
const ACTIVE_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;

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
  return tx.customer.create({ data: { name, email }, select: { id: true } });
}

async function createEmailTicket(
  tx: Prisma.TransactionClient,
  customerId: string,
  subject: string,
  body: string,
  now: Date,
) {
  const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
  const ticket = await tx.ticket.create({
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
    select: { id: true, status: true, subject: true, assignedAgentId: true, emailThreadToken: true },
  });
  await tx.ticketHistory.create({
    data: { ticketId: ticket.id, actorUserId: null, action: "TICKET_CREATED", newValue: TicketStatus.OPEN },
  });
  return ticket;
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

  const active = await tx.ticket.findMany({
    where: { customerId, channel: Channel.EMAIL, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { id: true, status: true, subject: true, assignedAgentId: true, emailThreadToken: true },
  });
  return active.length === 1 ? active[0]! : null;
}

async function notifyInbound(
  tx: Prisma.TransactionClient,
  ticket: { id: string; subject: string; assignedAgentId: string | null },
) {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: { in: [Role.ADMIN, Role.MANAGER] } },
        ...(ticket.assignedAgentId ? [{ id: ticket.assignedAgentId }] : []),
      ],
    },
    select: { id: true },
  });
  await createNotifications(
    tx,
    users.map((user) => user.id),
    "CUSTOMER_REPLY",
    "Customer replied",
    `Customer replied to ticket #${ticket.id}: ${ticket.subject}`,
    ticket.id,
  );
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
      await notifyInbound(tx, ticket);
      return {
        status: createdTicket ? "TICKET_CREATED" as const : "MESSAGE_APPENDED" as const,
        ticketId: ticket.id,
        messageId,
        assignedAgentId: ticket.assignedAgentId,
        customerId: customer.id,
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
    console.error(`email: outbound send failed ticket=${params.ticketId} operation=${error instanceof ResendEmailError ? error.operation : "send"}`);
    throw new AppError(502, "EMAIL_DELIVERY_FAILED", "Resend rejected or could not deliver the email reply");
  }
}

export const emailInternals = { emailSubject, threadAddress, messageIds, normalizeInboundBody, SYSTEM_USER_EMAIL };
