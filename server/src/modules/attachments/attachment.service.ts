import { randomUUID } from "node:crypto";
import { Prisma, Role, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { ticketVisibilityWhere } from "../tickets/ticket-visibility.js";
import { resolveActorTeamScope } from "../../shared/team/team-scope.js";
import { MAX_ATTACHMENT_BYTES } from "./attachment.constants.js";
import { detectFileType } from "./detect-file-type.js";
import { sanitizeFileName } from "./file-name.js";
import type { ParsedUpload } from "./parse-upload.js";
import {
  StorageObjectNotFoundError,
  StorageUnavailableError,
  getAttachmentStorage,
} from "./attachment-storage.js";

export interface Actor {
  userId: string;
  role: Role;
}

/** Persisted attachment context. Always built on the server from route params + auth. */
interface AttachmentContext {
  ticketId: string | null;
  messageId: string | null;
  customerId: string | null;
}

const internalSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  createdAt: true,
  ticketId: true,
  messageId: true,
  customerId: true,
} satisfies Prisma.AttachmentSelect;

type InternalRow = Prisma.AttachmentGetPayload<{ select: typeof internalSelect }>;

/** Internal metadata projection — never exposes storageKey or provider data. */
export interface InternalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
  ticketId: string | null;
  messageId: string | null;
  customerId: string | null;
}

/** Portal metadata projection — messageId only, for conversation grouping. */
export interface PortalAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: Date;
  messageId: string | null;
}

const listOrder: Prisma.AttachmentOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

function toInternal(row: InternalRow): InternalAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    createdAt: row.createdAt,
    ticketId: row.ticketId,
    messageId: row.messageId,
    customerId: row.customerId,
  };
}

function toPortal(row: Pick<InternalRow, "id" | "fileName" | "mimeType" | "createdAt" | "messageId">): PortalAttachment {
  return { id: row.id, fileName: row.fileName, mimeType: row.mimeType, createdAt: row.createdAt, messageId: row.messageId };
}

function ticketNotFound() {
  return new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
}
function attachmentNotFound() {
  return new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
}
function storageUnavailable() {
  return new AppError(503, "STORAGE_UNAVAILABLE", "Attachment storage is currently unavailable");
}

async function customerIdForUser(userId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError(403, "CUSTOMER_PROFILE_REQUIRED", "A linked customer profile is required");
  return customer.id;
}

async function requireVisibleTicket(ticketId: string, actor: Actor) {
  // Team-scoped (feature/team-based-manager-scope): a MANAGER cannot list/upload
  // attachments on another team's ticket by id.
  const team = await resolveActorTeamScope(actor);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor, team) },
    select: { id: true, status: true, assignedAgentId: true },
  });
  if (!ticket) throw ticketNotFound();
  return ticket;
}

function requireAssignedAgent(ticket: { assignedAgentId: string | null }, actor: Actor) {
  if (actor.role === Role.AGENT && ticket.assignedAgentId !== actor.userId) {
    throw new AppError(403, "FORBIDDEN", "The ticket must be assigned to you before uploading an attachment");
  }
}

function assertContext(context: AttachmentContext) {
  const hasTicket = context.ticketId != null;
  const hasMessage = context.messageId != null;
  const hasCustomer = context.customerId != null;
  const ticketOnly = hasTicket && !hasMessage && !hasCustomer;
  const messageLevel = hasTicket && hasMessage && !hasCustomer;
  const customerOnly = hasCustomer && !hasTicket && !hasMessage;
  if (!ticketOnly && !messageLevel && !customerOnly) {
    throw new AppError(422, "INVALID_ATTACHMENT_CONTEXT", "Unsupported attachment context");
  }
}

// ---------------------------------------------------------------------------
// Internal listing
// ---------------------------------------------------------------------------

/** Ticket-level attachments plus message-level attachments whose message belongs to the ticket. Each row once. */
export async function listTicketAttachments(ticketId: string, actor: Actor): Promise<{ data: InternalAttachment[] }> {
  await requireVisibleTicket(ticketId, actor);
  const rows = await prisma.attachment.findMany({
    where: { OR: [{ ticketId, messageId: null }, { message: { ticketId } }] },
    orderBy: listOrder,
    select: internalSelect,
  });
  return { data: rows.map(toInternal) };
}

export async function listMessageAttachments(
  ticketId: string,
  messageId: string,
  actor: Actor,
): Promise<{ data: InternalAttachment[] }> {
  await requireVisibleTicket(ticketId, actor);
  const message = await prisma.ticketMessage.findFirst({ where: { id: messageId, ticketId }, select: { id: true } });
  if (!message) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
  const rows = await prisma.attachment.findMany({ where: { messageId }, orderBy: listOrder, select: internalSelect });
  return { data: rows.map(toInternal) };
}

export async function listCustomerAttachments(customerId: string): Promise<{ data: InternalAttachment[] }> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  const rows = await prisma.attachment.findMany({ where: { customerId }, orderBy: listOrder, select: internalSelect });
  return { data: rows.map(toInternal) };
}

// ---------------------------------------------------------------------------
// Authorization for upload (runs before the multipart body is read)
// ---------------------------------------------------------------------------

export async function authorizeTicketUpload(ticketId: string, actor: Actor): Promise<AttachmentContext> {
  const ticket = await requireVisibleTicket(ticketId, actor);
  requireAssignedAgent(ticket, actor);
  return { ticketId, messageId: null, customerId: null };
}

export async function authorizeMessageUpload(
  ticketId: string,
  messageId: string,
  actor: Actor,
): Promise<AttachmentContext> {
  const ticket = await requireVisibleTicket(ticketId, actor);
  requireAssignedAgent(ticket, actor);
  const message = await prisma.ticketMessage.findFirst({
    where: { id: messageId, ticketId },
    select: { id: true, authorUserId: true },
  });
  if (!message) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
  // Authorship rule: nobody (including ADMIN/MANAGER) may attach a file to another
  // user's public message.
  if (message.authorUserId !== actor.userId) {
    throw new AppError(403, "FORBIDDEN", "You can only attach files to your own message");
  }
  return { ticketId, messageId, customerId: null };
}

export async function authorizeCustomerUpload(customerId: string): Promise<AttachmentContext> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  return { customerId, ticketId: null, messageId: null };
}

// ---------------------------------------------------------------------------
// Persist (signature validation -> key -> provider put -> DB create -> cleanup)
// ---------------------------------------------------------------------------

export async function persistUpload(context: AttachmentContext, upload: ParsedUpload): Promise<InternalRow> {
  assertContext(context);

  const mimeType = detectFileType(upload.buffer);
  if (!mimeType) throw new AppError(415, "UNSUPPORTED_FILE_TYPE", "This file type is not allowed");

  const fileName = sanitizeFileName(upload.fileName);
  const storageKey = `attachments/${randomUUID()}`;

  let storage;
  try {
    storage = await getAttachmentStorage();
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }

  try {
    await storage.put(storageKey, upload.buffer, { contentType: mimeType });
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }

  try {
    return await prisma.attachment.create({
      data: {
        ticketId: context.ticketId,
        messageId: context.messageId,
        customerId: context.customerId,
        fileName,
        mimeType,
        storageKey,
      },
      select: internalSelect,
    });
  } catch (dbError) {
    // Provider upload succeeded but metadata creation failed: attempt immediate
    // cleanup. No partial metadata is created. There is no background orphan worker.
    try {
      await storage.remove(storageKey);
    } catch {
      // Cleanup also failed: preserve the original failure, log the orphan key
      // for operator cleanup. Never log tokens or file contents.
      console.error(`attachment orphan: provider object left behind at storageKey=${storageKey}`);
    }
    void dbError;
    throw new AppError(500, "ATTACHMENT_UPLOAD_FAILED", "The attachment could not be saved");
  }
}

export function projectInternal(row: InternalRow): InternalAttachment {
  return toInternal(row);
}
export function projectPortal(row: InternalRow): PortalAttachment {
  return toPortal(row);
}

// ---------------------------------------------------------------------------
// Download (authorize -> head size bound -> get bytes). Uses the stored,
// server-validated mimeType, never a provider-reported value.
// ---------------------------------------------------------------------------

export interface ResolvedDownload {
  storageKey: string;
  fileName: string;
  mimeType: string;
}

export interface DownloadedAttachment {
  body: Buffer;
  fileName: string;
  mimeType: string;
}

export async function resolveInternalDownload(attachmentId: string, actor: Actor): Promise<ResolvedDownload> {
  const row = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { fileName: true, mimeType: true, storageKey: true, ticketId: true, messageId: true, customerId: true },
  });
  if (!row) throw attachmentNotFound();

  if (row.ticketId) {
    const team = await resolveActorTeamScope(actor);
    const ticket = await prisma.ticket.findFirst({
      where: { id: row.ticketId, ...ticketVisibilityWhere(actor, team) },
      select: { id: true },
    });
    if (!ticket) throw attachmentNotFound();
  } else if (row.customerId) {
    // Every internal read role (ADMIN/MANAGER/AGENT) may read customer-profile
    // attachments; the router already enforces the role group.
    const customer = await prisma.customer.findUnique({ where: { id: row.customerId }, select: { id: true } });
    if (!customer) throw attachmentNotFound();
  } else {
    throw attachmentNotFound();
  }

  return { storageKey: row.storageKey, fileName: row.fileName, mimeType: row.mimeType };
}

export async function resolvePortalDownload(attachmentId: string, userId: string): Promise<ResolvedDownload> {
  const customerId = await customerIdForUser(userId);
  const row = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
      customerId: true,
      ticket: { select: { customerId: true } },
      message: { select: { ticket: { select: { customerId: true } } } },
    },
  });
  if (!row) throw attachmentNotFound();
  // Portal never exposes customer-profile attachments.
  const owningCustomerId = row.ticket?.customerId ?? row.message?.ticket?.customerId ?? null;
  if (!owningCustomerId || owningCustomerId !== customerId) throw attachmentNotFound();
  return { storageKey: row.storageKey, fileName: row.fileName, mimeType: row.mimeType };
}

export async function readAttachmentBytes(resolved: ResolvedDownload): Promise<DownloadedAttachment> {
  let storage;
  try {
    storage = await getAttachmentStorage();
  } catch (error) {
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }

  let size: number;
  try {
    ({ size } = await storage.head(resolved.storageKey));
  } catch (error) {
    if (error instanceof StorageObjectNotFoundError) throw attachmentNotFound();
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new AppError(413, "FILE_TOO_LARGE", "The stored attachment exceeds the maximum allowed size");
  }

  let body: Buffer;
  try {
    ({ body } = await storage.get(resolved.storageKey));
  } catch (error) {
    if (error instanceof StorageObjectNotFoundError) throw attachmentNotFound();
    if (error instanceof StorageUnavailableError) throw storageUnavailable();
    throw error;
  }

  return { body, fileName: resolved.fileName, mimeType: resolved.mimeType };
}

// ---------------------------------------------------------------------------
// Portal listing / upload authorization
// ---------------------------------------------------------------------------

export async function listPortalTicketAttachments(
  ticketId: string,
  userId: string,
): Promise<{ data: PortalAttachment[] }> {
  const customerId = await customerIdForUser(userId);
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, customerId }, select: { id: true } });
  if (!ticket) throw ticketNotFound();
  const rows = await prisma.attachment.findMany({
    where: { OR: [{ ticketId, messageId: null }, { message: { ticketId } }] },
    orderBy: listOrder,
    select: { id: true, fileName: true, mimeType: true, createdAt: true, messageId: true },
  });
  return { data: rows.map(toPortal) };
}

export async function authorizePortalTicketUpload(ticketId: string, userId: string): Promise<AttachmentContext> {
  const customerId = await customerIdForUser(userId);
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, customerId }, select: { id: true, status: true } });
  if (!ticket) throw ticketNotFound();
  if (ticket.status === TicketStatus.CLOSED) {
    throw new AppError(409, "TICKET_CLOSED", "Closed tickets do not accept new attachments");
  }
  // A file upload alone never creates a message or reopens the ticket.
  return { ticketId, messageId: null, customerId: null };
}
