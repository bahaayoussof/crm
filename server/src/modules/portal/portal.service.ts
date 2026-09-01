import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createNotifications } from "../notifications/notification.service.js";
import { notifyWatchers, NOTIFICATION_WATCH_ACTIVITY } from "../collaboration/collaboration.service.js";
import { sanitizeReplyHtml } from "../../shared/rich-text/reply-html.js";
import { emitTicketMessageCreated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { ticketOperationalRecipientIds } from "../../shared/team/team-scope.js";
import type { PortalCreateTicketInput, PortalReplyInput, PortalStatus, PortalTicketListQuery } from "./portal.schema.js";

const listSelect = { id: true, subject: true, status: true, category: { select: { id: true, name: true } }, createdAt: true, updatedAt: true } satisfies Prisma.TicketSelect;
// "My Requests" table only — adds the customer-safe `priority` column/filter support.
// Kept separate from `listSelect` so overview / detail / create response shapes are unchanged.
const ticketListSelect = { ...listSelect, priority: true } satisfies Prisma.TicketSelect;
const messageSelect = { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } satisfies Prisma.TicketMessageSelect;
const statusMap: Record<TicketStatus, PortalStatus> = {
  OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", ESCALATED: "IN_PROGRESS",
  WAITING_CUSTOMER: "WAITING_FOR_YOU", RESOLVED: "RESOLVED", CLOSED: "CLOSED",
};
const storedStatuses: Record<PortalStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.OPEN], IN_PROGRESS: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED],
  WAITING_FOR_YOU: [TicketStatus.WAITING_CUSTOMER], RESOLVED: [TicketStatus.RESOLVED], CLOSED: [TicketStatus.CLOSED],
};

async function customerIdFor(userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError(403, "CUSTOMER_PROFILE_REQUIRED", "A linked customer profile is required");
  return customer.id;
}
const ticketItem = <T extends { status: TicketStatus }>(ticket: T) => ({ ...ticket, status: statusMap[ticket.status] });

export async function overview(userId: string) {
  const customerId = await customerIdFor(userId);
  const [open, waitingForYou, resolved, recent] = await prisma.$transaction([
    prisma.ticket.count({ where: { customerId, status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED] } } }),
    prisma.ticket.count({ where: { customerId, status: TicketStatus.WAITING_CUSTOMER } }),
    prisma.ticket.count({ where: { customerId, status: TicketStatus.RESOLVED } }),
    prisma.ticket.findMany({ where: { customerId }, take: 5, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: listSelect }),
  ]);
  return { counts: { open, waitingForYou, resolved }, recentTickets: recent.map(ticketItem) };
}

export async function categories(userId: string) {
  await customerIdFor(userId);
  return prisma.category.findMany({ where: { isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true } });
}

export async function tickets(query: PortalTicketListQuery, userId: string) {
  const customerId = await customerIdFor(userId);
  // Ownership is enforced in the query: every branch below is ANDed with `customerId`.
  const where: Prisma.TicketWhereInput = { customerId,
    ...(query.status && { status: { in: storedStatuses[query.status] } }),
    ...(query.priority && { priority: query.priority }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.search && { AND: [{ OR: [{ id: query.search }, { subject: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }] }] }),
  };
  const [records, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: ticketListSelect }),
    prisma.ticket.count({ where }),
  ]);
  return { data: records.map(ticketItem), meta: { page: query.page, limit: query.limit, total, totalPages: total ? Math.ceil(total / query.limit) : 0 } };
}

export async function ticketDetail(id: string, userId: string) {
  const customerId = await customerIdFor(userId);
  const ticket = await prisma.ticket.findFirst({ where: { id, customerId }, select: {
    ...listSelect, description: true,
    messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: messageSelect },
    feedback: { select: { rating: true, comment: true, createdAt: true } },
  } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const feedbackEligible = ticket.status === TicketStatus.RESOLVED || ticket.status === TicketStatus.CLOSED;
  return { ...ticketItem(ticket), feedbackEligible, feedback: ticket.feedback ?? null,
    messages: ticket.messages.map((message) => ({ ...message, author: { id: message.author.id, name: message.author.name, kind: message.author.role === Role.CUSTOMER ? "CUSTOMER" as const : "SUPPORT" as const } })) };
}

export async function createTicket(input: PortalCreateTicketInput, userId: string) {
  const customerId = await customerIdFor(userId);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    if (input.categoryId) {
      const category = await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
      if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
    }
    const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
    const ticket = await tx.ticket.create({ data: { subject: input.subject, description: input.description, categoryId: input.categoryId ?? null,
      customerId, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, channel: Channel.WEB,
      assignedAgentId: null, departmentId: null, branchId: null, createdAt: now,
      firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
      resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
    }, select: listSelect });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: userId, action: "TICKET_CREATED", newValue: TicketStatus.OPEN } });
    return ticketItem(ticket);
  });
}

export async function reply(id: string, input: PortalReplyInput, userId: string) {
  const customerId = await customerIdFor(userId);
  return withRealtimeOutbox(async () => {
   const { result, assignedAgentId, teamId } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({ where: { id, customerId }, select: { id: true, status: true, subject: true, assignedAgentId: true, teamId: true } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    if (ticket.status === TicketStatus.CLOSED) throw new AppError(409, "TICKET_CLOSED", "Closed tickets do not accept replies");
    // The Portal composer is the shared rich Lexical editor. Sanitize the HTML to
    // the support allowlist at this trust boundary (same as staff replies); the
    // `MessageBody` render guard re-sanitizes as defence in depth.
    const body = sanitizeReplyHtml(input.body);
    if (!body) throw new AppError(422, "EMPTY_MESSAGE", "Reply body is required");
    const message = await tx.ticketMessage.create({ data: { ticketId: id, authorUserId: userId, body }, select: messageSelect });
    const next = ticket.status === TicketStatus.WAITING_CUSTOMER ? TicketStatus.IN_PROGRESS : ticket.status === TicketStatus.RESOLVED ? TicketStatus.OPEN : null;
    if (next) {
      await tx.ticket.update({ where: { id }, data: { status: next, ...(ticket.status === TicketStatus.RESOLVED && { resolvedAt: null }) } });
      await tx.ticketHistory.create({ data: { ticketId: id, actorUserId: userId, action: "STATUS_CHANGED", oldValue: ticket.status, newValue: next } });
    }

    // Fan-out: assigned agent + every active ADMIN + ONLY this ticket's team
    // manager (feature/team-based-manager-scope — an unrouted ticket reaches
    // ADMINs only). The customer author is excluded.
    const filtered = await ticketOperationalRecipientIds(tx, {
      teamId: ticket.teamId,
      assignedAgentId: ticket.assignedAgentId,
      excludeUserId: userId,
    });
    await createNotifications(tx, filtered, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${id}: ${ticket.subject}`, id);

    // feature/team-collaboration — also notify internal watchers who are not
    // already covered by the assignee / admin / manager fan-out above. The
    // customer (author) is excluded via actorUserId.
    await notifyWatchers(tx, {
      ticketId: id,
      actorUserId: userId,
      type: NOTIFICATION_WATCH_ACTIVITY,
      title: "Customer replied on a ticket you follow",
      message: `Customer replied to ticket #${id}: ${ticket.subject}`,
      excludeUserIds: filtered,
    });

    return {
      result: { id: message.id, body: message.body, createdAt: message.createdAt, author: { id: message.author.id, name: message.author.name, kind: "CUSTOMER" as const } },
      assignedAgentId: ticket.assignedAgentId,
      teamId: ticket.teamId,
    };
   });
   emitTicketMessageCreated({ ticketId: id, messageId: result.id, assignedAgentId, customerId, teamId, visibility: "public" });
   return result;
  });
}

function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
export const portalStatus = { map: statusMap, stored: storedStatuses };
