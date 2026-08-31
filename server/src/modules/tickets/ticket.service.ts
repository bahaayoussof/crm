import { Channel, Prisma, Role, TicketStatus } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { deriveSla } from "../../shared/sla/derive-sla.js";
import { createNotifications } from "../notifications/notification.service.js";
import {
  applyNoteMentions,
  notifyWatchers,
  NOTIFICATION_WATCH_ACTIVITY,
} from "../collaboration/collaboration.service.js";
import { deliverOutboundReply } from "../integrations/whatsapp/whatsapp.service.js";
import { deliverEmailReply } from "../integrations/email/email.service.js";
import { replyHtmlToPlainText, sanitizeReplyHtml } from "../../shared/rich-text/reply-html.js";
import {
  emitTicketMessageCreated,
  emitTicketUpdated,
  withRealtimeOutbox,
} from "../realtime/realtime.publisher.js";
import type { CreateTicketInput, TicketConversationInput, TicketListQuery, UpdateTicketInput } from "./ticket.schema.js";
import { ticketVisibilityWhere, type TicketActor as Actor } from "./ticket-visibility.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";

const ticketSummarySelect = {
  id: true, subject: true, status: true, priority: true, channel: true,
  firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true,
  createdAt: true, updatedAt: true,
  customer: { select: { id: true, name: true, email: true } },
  assignedAgent: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.ESCALATED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED],
  IN_PROGRESS: [TicketStatus.WAITING_CUSTOMER, TicketStatus.RESOLVED, TicketStatus.ESCALATED],
  WAITING_CUSTOMER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.ESCALATED],
  RESOLVED: [TicketStatus.CLOSED],
  CLOSED: [],
  ESCALATED: [TicketStatus.IN_PROGRESS],
};

export async function listTickets(query: TicketListQuery, actor: Actor) {
  const where: Prisma.TicketWhereInput = {
    ...ticketVisibilityWhere(actor),
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.assignedAgentId && { assignedAgentId: query.assignedAgentId }),
    ...(query.customerId && { customerId: query.customerId }),
    ...(query.departmentId && { departmentId: query.departmentId }),
    ...(query.branchId && { branchId: query.branchId }),
    ...(query.search && { AND: [{ OR: [
      { id: query.search },
      { subject: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { customer: { name: { contains: query.search, mode: "insensitive" } } },
      { customer: { email: { contains: query.search, mode: "insensitive" } } },
    ] }] }),
  };
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip, take: query.limit, orderBy: { updatedAt: "desc" }, select: ticketSummarySelect }),
    prisma.ticket.count({ where }),
  ]);
  return { data: records, meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
}

export async function getTicket(ticketId: string, actor: Actor, now = new Date()) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor) },
    select: {
      ...ticketSummarySelect, description: true, resolvedAt: true, closedAt: true,
      department: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      history: { orderBy: { createdAt: "desc" }, select: {
        id: true, action: true, oldValue: true, newValue: true, createdAt: true,
        actor: { select: { id: true, name: true, role: true } },
      } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: conversationSelect },
      notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: conversationSelect },
      _count: { select: { watchers: true } },
      watchers: { where: { userId: actor.userId }, select: { id: true }, take: 1 },
    },
  });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const { messages, notes, _count, watchers, ...detail } = ticket;
  return {
    ...detail,
    ...deriveSla(detail, now),
    watcherCount: _count?.watchers ?? 0,
    viewerIsWatching: (watchers?.length ?? 0) > 0,
    conversation: [
      ...messages.map((item) => ({ ...item, kind: "PUBLIC_MESSAGE" as const })),
      ...notes.map((item) => ({ ...item, kind: "INTERNAL_NOTE" as const })),
    ].sort(compareConversation),
  };
}

export async function addTicketMessage(ticketId: string, input: TicketConversationInput, actor: Actor) {
 return withRealtimeOutbox(async () => {
  const createdAt = new Date();
  const messageId = randomUUID();
  // Public replies are rich text from the Lexical composer. Sanitize to the
  // support-reply allowlist here — this is the trust boundary, not the client.
  const body = sanitizeReplyHtml(input.body);
  if (!body) throw new AppError(422, "EMPTY_MESSAGE", "Message body is required");
  const { message, channel, customerPhone, emailExternalId, assignedAgentId, customerId } = await prisma.$transaction(async (tx) => {
    const ticket = await requireConversationMutationAccess(tx, ticketId, actor);
    let emailExternalId: string | null = null;
    if (ticket.channel === Channel.EMAIL) {
      const threadToken = ticket.emailThreadToken ?? randomBytes(18).toString("base64url");
      if (!ticket.emailThreadToken) {
        await tx.ticket.update({ where: { id: ticketId }, data: { emailThreadToken: threadToken } });
      }
      const thread = await tx.ticketMessage.findMany({
        where: { ticketId, externalMessageId: { not: null } },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { externalMessageId: true },
      });
      const references = thread.flatMap((item) => item.externalMessageId ? [item.externalMessageId] : []);
      const delivery = await deliverEmailReply({
        ticketId,
        messageId,
        recipient: ticket.customer.email,
        subject: ticket.subject,
        body,
        threadToken,
        inReplyTo: references.at(-1) ?? null,
        references,
      });
      emailExternalId = delivery.externalId;
    }
    const created = await tx.ticketMessage.create({
      data: { id: messageId, ticketId, authorUserId: actor.userId, body, createdAt, externalId: emailExternalId },
      select: conversationSelect,
    });
    await tx.ticket.updateMany({ where: { id: ticketId, firstRespondedAt: null }, data: { firstRespondedAt: createdAt } });
    // Watcher fan-out: a staff reply is activity on a followed ticket.
    await notifyWatchers(tx, {
      ticketId,
      actorUserId: actor.userId,
      type: NOTIFICATION_WATCH_ACTIVITY,
      title: "New reply on a ticket you follow",
      message: `${created.author.name} replied on ticket #${ticketId}: ${ticket.subject}`,
    });
    return {
      message: { ...created, kind: "PUBLIC_MESSAGE" as const },
      channel: ticket.channel,
      customerPhone: ticket.customer?.phone ?? null,
      emailExternalId,
      assignedAgentId: ticket.assignedAgentId,
      customerId: ticket.customerId,
    };
  });

  // Persistence committed — signal connected clients (transaction-safe: buffered
  // by withRealtimeOutbox, flushed when this function resolves).
  emitTicketMessageCreated({ ticketId, messageId: message.id, assignedAgentId, customerId, visibility: "public" });

  // Outbound transport for WhatsApp-originated tickets. The message is already
  // committed above, so a delivery failure never corrupts the conversation — it
  // is reported back to the caller and recorded as a ticket history row.
  if (channel === Channel.WHATSAPP) {
    // WhatsApp carries plain text only — never send reply markup to the customer.
    const delivery = await deliverOutboundReply({
      ticketId,
      messageId: message.id,
      to: customerPhone,
      text: replyHtmlToPlainText(body),
    });
    return { ...message, delivery };
  }
  if (channel === Channel.EMAIL) {
    return { ...message, delivery: { channel: "EMAIL", status: "SENT", externalId: emailExternalId! } as const };
  }
  return message;
 });
}

export async function addTicketNote(ticketId: string, input: TicketConversationInput, actor: Actor) {
  // Internal notes are rich text from the same Lexical editor as public replies
  // (with @mentions). Sanitize to the support allowlist at this trust boundary;
  // the `@[Name](userId)` mention tokens are plain text and survive intact.
  const body = sanitizeReplyHtml(input.body);
  if (!body) throw new AppError(422, "EMPTY_MESSAGE", "Note body is required");
  return withRealtimeOutbox(async () => {
   const result = await prisma.$transaction(async (tx) => {
    const ticket = await requireConversationMutationAccess(tx, ticketId, actor);
    const note = await tx.ticketNote.create({
      data: { ticketId, authorUserId: actor.userId, body },
      select: conversationSelect,
    });
    // @mentions: records + auto-watch + mention notifications. Returns the
    // mentioned ids so they are excluded from the generic watcher fan-out below.
    const mentionedIds = await applyNoteMentions(tx, {
      ticketId,
      noteId: note.id,
      body,
      authorUserId: actor.userId,
      authorName: note.author.name,
      ticketSubject: ticket.subject,
    });
    await notifyWatchers(tx, {
      ticketId,
      actorUserId: actor.userId,
      type: NOTIFICATION_WATCH_ACTIVITY,
      title: "New note on a ticket you follow",
      message: `${note.author.name} added an internal note on ticket #${ticketId}: ${ticket.subject}`,
      excludeUserIds: mentionedIds,
    });
    return { note: { ...note, kind: "INTERNAL_NOTE" as const }, assignedAgentId: ticket.assignedAgentId, customerId: ticket.customerId };
   });
   emitTicketMessageCreated({
     ticketId,
     messageId: result.note.id,
     assignedAgentId: result.assignedAgentId,
     customerId: result.customerId,
     visibility: "internal",
   });
   return result.note;
  });
}

export async function createTicket(input: CreateTicketInput, actor: Actor, requestContext?: AuditRequestContext) {
  if (actor.role === Role.AGENT && input.assignedAgentId !== undefined) throw forbidden("Agents cannot choose a ticket assignee");
  const creationInput: CreateTicketInput = actor.role === Role.AGENT ? { ...input, assignedAgentId: actor.userId } : input;
  const now = new Date();
  return withRealtimeOutbox(async () => {
   const ticket = await prisma.$transaction(async (tx) => {
    const relations = await validateRelations(tx, creationInput);
    const sla = await tx.slaRule.findFirst({ where: { priority: creationInput.priority, isActive: true } });
    const ticket = await tx.ticket.create({
      data: {
        ...creationInput, createdAt: now,
        firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
        resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
      },
      select: ticketSummarySelect,
    });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "TICKET_CREATED", newValue: TicketStatus.NEW } });
    await createAuditLog({ actorId: actor.userId, action: AUDIT_ACTIONS.TICKET_CREATED, entityType: AUDIT_ENTITY_TYPES.TICKET, entityId: ticket.id, changes: { status: { to: ticket.status }, priority: { to: ticket.priority }, categoryId: { to: creationInput.categoryId ?? null }, assignedAgentId: { to: creationInput.assignedAgentId ?? null } }, requestContext }, tx);
    if (creationInput.assignedAgentId) await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "ASSIGNMENT_CHANGED", newValue: relations.agent?.name ?? creationInput.assignedAgentId } });
    if (creationInput.categoryId) await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "CATEGORY_CHANGED", newValue: relations.category?.name ?? creationInput.categoryId } });
    // Notify newly assigned agent (only when the assignee is different from the actor)
    if (creationInput.assignedAgentId && creationInput.assignedAgentId !== actor.userId) {
      const assignee = await tx.user.findFirst({ where: { id: creationInput.assignedAgentId, isActive: true }, select: { id: true } });
      if (assignee) {
        await createNotifications(tx, [assignee.id], "TICKET_ASSIGNED", "New ticket assigned", `You have been assigned ticket #${ticket.id}: ${ticket.subject}`, ticket.id);
      }
    }
    return ticket;
   });
   emitTicketUpdated({ ticketId: ticket.id, assignedAgentId: ticket.assignedAgent?.id ?? null, customerId: ticket.customer?.id ?? null });
   return ticket;
  });
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput, actor: Actor, requestContext?: AuditRequestContext) {
  const now = new Date();
  return withRealtimeOutbox(async () => {
   const { updated, changed } = await prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findFirst({
      where: { id: ticketId, ...ticketVisibilityWhere(actor) },
      select: { id: true, subject: true, description: true, status: true, priority: true, categoryId: true, assignedAgentId: true, departmentId: true, branchId: true, firstRespondedAt: true, category: { select: { name: true } }, assignedAgent: { select: { name: true } } },
    });
    if (!current) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

    enforceMutationPermissions(current, input, actor);
    const relations = await validateRelations(tx, input, { departmentId: input.departmentId ?? current.departmentId, branchId: input.branchId ?? current.branchId });
    if (input.status && input.status !== current.status) validateTransition(current.status, input.status, actor.role);

    const data: Prisma.TicketUpdateInput = {};
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.categoryId !== undefined) data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    if (input.assignedAgentId !== undefined) data.assignedAgent = input.assignedAgentId ? { connect: { id: input.assignedAgentId } } : { disconnect: true };
    if (input.departmentId !== undefined) data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
    if (input.branchId !== undefined) data.branch = input.branchId ? { connect: { id: input.branchId } } : { disconnect: true };
    if (input.status === TicketStatus.RESOLVED && current.status !== TicketStatus.RESOLVED) data.resolvedAt = now;
    if (input.status === TicketStatus.CLOSED && current.status !== TicketStatus.CLOSED) data.closedAt = now;

    if (input.priority && input.priority !== current.priority && current.status !== TicketStatus.RESOLVED && current.status !== TicketStatus.CLOSED) {
      const sla = await tx.slaRule.findFirst({ where: { priority: input.priority, isActive: true } });
      if (current.firstRespondedAt === null) data.firstResponseDueAt = sla ? addMinutes(now, sla.firstResponseMinutes) : null;
      data.resolutionDueAt = sla ? addMinutes(now, sla.resolutionMinutes) : null;
    }

    const updated = await tx.ticket.update({ where: { id: ticketId }, data, select: ticketSummarySelect });
    const events: Prisma.TicketHistoryCreateManyInput[] = [];
    if (input.status && input.status !== current.status) events.push(history(ticketId, actor.userId, "STATUS_CHANGED", current.status, input.status));
    if (input.priority && input.priority !== current.priority) events.push(history(ticketId, actor.userId, "PRIORITY_CHANGED", current.priority, input.priority));
    if (input.assignedAgentId !== undefined && input.assignedAgentId !== current.assignedAgentId) events.push(history(ticketId, actor.userId, "ASSIGNMENT_CHANGED", current.assignedAgent?.name ?? null, relations.agent?.name ?? null));
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) events.push(history(ticketId, actor.userId, "CATEGORY_CHANGED", current.category?.name ?? null, relations.category?.name ?? null));
    if (events.length) await tx.ticketHistory.createMany({ data: events });
    const auditEvents = [
      input.status && input.status !== current.status && { action: input.status === TicketStatus.ESCALATED ? AUDIT_ACTIONS.TICKET_ESCALATED : input.status === TicketStatus.CLOSED ? AUDIT_ACTIONS.TICKET_CLOSED : AUDIT_ACTIONS.TICKET_STATUS_CHANGED, changes: { status: { from: current.status, to: input.status } } },
      input.priority && input.priority !== current.priority && { action: AUDIT_ACTIONS.TICKET_PRIORITY_CHANGED, changes: { priority: { from: current.priority, to: input.priority } } },
      input.assignedAgentId !== undefined && input.assignedAgentId !== current.assignedAgentId && { action: AUDIT_ACTIONS.TICKET_ASSIGNED, changes: { assignedAgentId: { from: current.assignedAgentId, to: input.assignedAgentId } } },
      input.categoryId !== undefined && input.categoryId !== current.categoryId && { action: AUDIT_ACTIONS.TICKET_CATEGORY_CHANGED, changes: { categoryId: { from: current.categoryId, to: input.categoryId } } },
    ].filter(Boolean) as unknown as { action: string; changes: Record<string, { from: string | null; to: string | null }> }[];
    for (const event of auditEvents) await createAuditLog({ actorId: actor.userId, action: event.action, entityType: AUDIT_ENTITY_TYPES.TICKET, entityId: ticketId, changes: event.changes, requestContext }, tx);

    // Assignment notification: new assignee changed, non-null, not the actor
    const assigneeChanged = input.assignedAgentId !== undefined && input.assignedAgentId !== current.assignedAgentId;
    if (assigneeChanged && input.assignedAgentId && input.assignedAgentId !== actor.userId) {
      const assignee = await tx.user.findFirst({ where: { id: input.assignedAgentId, isActive: true }, select: { id: true } });
      if (assignee) {
        await createNotifications(tx, [assignee.id], "TICKET_ASSIGNED", "New ticket assigned", `You have been assigned ticket #${ticketId}: ${current.subject}`, ticketId);
      }
    }

    // Escalation notification: status transitions INTO ESCALATED
    const escalated = input.status === TicketStatus.ESCALATED && current.status !== TicketStatus.ESCALATED;
    let escalationRecipientIds: string[] = [];
    if (escalated) {
      const adminsManagers = await tx.user.findMany({
        where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true, id: { not: actor.userId } },
        select: { id: true },
      });
      escalationRecipientIds = adminsManagers.map((u) => u.id);
      if (escalationRecipientIds.length > 0) {
        await createNotifications(tx, escalationRecipientIds, "TICKET_ESCALATED", "Ticket escalated", `Ticket #${ticketId}: ${current.subject} has been escalated`, ticketId);
      }
    }

    // Watcher fan-out — status and assignment changes. Actor is always excluded
    // by notifyWatchers; recipients already notified by the TICKET_ESCALATED /
    // TICKET_ASSIGNED notifications above are excluded explicitly so a watcher is
    // never notified twice for the same event.
    if (input.status && input.status !== current.status) {
      await notifyWatchers(tx, {
        ticketId,
        actorUserId: actor.userId,
        type: NOTIFICATION_WATCH_ACTIVITY,
        title: "Status changed on a ticket you follow",
        message: `Ticket #${ticketId}: ${current.subject} — status ${current.status} → ${input.status}`,
        excludeUserIds: escalationRecipientIds,
      });
    }
    if (assigneeChanged) {
      await notifyWatchers(tx, {
        ticketId,
        actorUserId: actor.userId,
        type: NOTIFICATION_WATCH_ACTIVITY,
        title: "Assignment changed on a ticket you follow",
        message: `Ticket #${ticketId}: ${current.subject} — assignment updated`,
        excludeUserIds: input.assignedAgentId ? [input.assignedAgentId] : [],
      });
    }

    const changed =
      (input.subject !== undefined && input.subject !== current.subject) ||
      (input.description !== undefined && input.description !== current.description) ||
      (input.priority !== undefined && input.priority !== current.priority) ||
      (input.status !== undefined && input.status !== current.status) ||
      (input.categoryId !== undefined && input.categoryId !== current.categoryId) ||
      (input.assignedAgentId !== undefined && input.assignedAgentId !== current.assignedAgentId) ||
      (input.departmentId !== undefined && input.departmentId !== current.departmentId) ||
      (input.branchId !== undefined && input.branchId !== current.branchId);
    return { updated, changed };
   });
   // Only signal when visible ticket state actually changed — a no-op PATCH stays quiet.
   if (changed) emitTicketUpdated({ ticketId, assignedAgentId: updated.assignedAgent?.id ?? null, customerId: updated.customer?.id ?? null });
   return updated;
  });
}

const conversationSelect = {
  id: true, body: true, createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TicketMessageSelect & Prisma.TicketNoteSelect;

async function requireConversationMutationAccess(tx: Prisma.TransactionClient, ticketId: string, actor: Actor) {
  const ticket = await tx.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor) },
    select: {
      id: true,
      subject: true,
      assignedAgentId: true,
      customerId: true,
      channel: true,
      emailThreadToken: true,
      customer: { select: { phone: true, email: true } },
    },
  });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  if (actor.role === Role.AGENT && ticket.assignedAgentId !== actor.userId) throw forbidden("Ticket must be assigned to the agent before adding conversation content");
  return ticket;
}

function compareConversation(left: { createdAt: Date; kind: string; id: string }, right: { createdAt: Date; kind: string; id: string }) {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

function enforceMutationPermissions(current: { assignedAgentId: string | null }, input: UpdateTicketInput, actor: Actor) {
  if (actor.role !== Role.AGENT) return;
  const allowedFields = new Set<keyof UpdateTicketInput>(["status", "priority"]);
  if ((Object.keys(input) as (keyof UpdateTicketInput)[]).some((field) => !allowedFields.has(field))) throw forbidden("Agents may update only ticket status and priority");
  if ((input.priority !== undefined || input.status !== undefined) && current.assignedAgentId !== actor.userId) throw forbidden("Ticket must be assigned to the agent before workflow changes");
}

function validateTransition(from: TicketStatus, to: TicketStatus, role: Role) {
  if (!transitions[from].includes(to)) throw new AppError(409, "INVALID_STATUS_TRANSITION", `Cannot transition ticket from ${from} to ${to}`);
  if ((from === TicketStatus.ESCALATED || to === TicketStatus.ESCALATED) && role === Role.AGENT) throw forbidden("Agents cannot change escalation status");
}

async function validateRelations(tx: Prisma.TransactionClient, input: Partial<CreateTicketInput & UpdateTicketInput>, organization?: { departmentId?: string | null; branchId?: string | null }) {
  const customer = input.customerId ? await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } }) : null;
  if (input.customerId && !customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  const agent = input.assignedAgentId ? await tx.user.findFirst({ where: { id: input.assignedAgentId, role: Role.AGENT }, select: { id: true, name: true } }) : null;
  if (input.assignedAgentId && !agent) throw new AppError(400, "INVALID_ASSIGNED_AGENT", "Assigned user must be an agent");
  const category = input.categoryId ? await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true, name: true } }) : null;
  if (input.categoryId && !category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  const departmentId = organization?.departmentId ?? input.departmentId;
  const branchId = organization?.branchId ?? input.branchId;
  const department = departmentId ? await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, branchId: true } }) : null;
  if (departmentId && !department) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
  const branch = branchId ? await tx.branch.findUnique({ where: { id: branchId }, select: { id: true } }) : null;
  if (branchId && !branch) throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
  if (department && branchId && department.branchId !== branchId) throw new AppError(400, "DEPARTMENT_BRANCH_MISMATCH", "Department does not belong to the selected branch");
  return { agent, category };
}

function history(ticketId: string, actorUserId: string, action: string, oldValue: string | null, newValue: string | null): Prisma.TicketHistoryCreateManyInput {
  return { ticketId, actorUserId, action, oldValue, newValue };
}
function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
function forbidden(message: string) { return new AppError(403, "FORBIDDEN", message); }

export const ticketWorkflow = { transitions };
