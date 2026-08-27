import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createNotifications } from "../notifications/notification.service.js";
import type { PortalCreateTicketInput, PortalReplyInput, PortalStatus, PortalTicketListQuery } from "./portal.schema.js";

const listSelect = { id: true, subject: true, status: true, category: { select: { id: true, name: true } }, createdAt: true, updatedAt: true } satisfies Prisma.TicketSelect;
const messageSelect = { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } satisfies Prisma.TicketMessageSelect;
const statusMap: Record<TicketStatus, PortalStatus> = {
  NEW: "OPEN", OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", ESCALATED: "IN_PROGRESS",
  WAITING_CUSTOMER: "WAITING_FOR_YOU", RESOLVED: "RESOLVED", CLOSED: "CLOSED",
};
const storedStatuses: Record<PortalStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.NEW, TicketStatus.OPEN], IN_PROGRESS: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED],
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
    prisma.ticket.count({ where: { customerId, status: { in: [TicketStatus.NEW, TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED] } } }),
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
  const where: Prisma.TicketWhereInput = { customerId,
    ...(query.status && { status: { in: storedStatuses[query.status] } }),
    ...(query.search && { AND: [{ OR: [{ id: query.search }, { subject: { contains: query.search, mode: "insensitive" } }, { description: { contains: query.search, mode: "insensitive" } }] }] }),
  };
  const [records, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: listSelect }),
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
      customerId, status: TicketStatus.NEW, priority: TicketPriority.MEDIUM, channel: Channel.WEB,
      assignedAgentId: null, departmentId: null, branchId: null, createdAt: now,
      firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
      resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
    }, select: listSelect });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: userId, action: "TICKET_CREATED", newValue: TicketStatus.NEW } });
    return ticketItem(ticket);
  });
}

export async function reply(id: string, input: PortalReplyInput, userId: string) {
  const customerId = await customerIdFor(userId);
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({ where: { id, customerId }, select: { id: true, status: true, subject: true, assignedAgentId: true } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    if (ticket.status === TicketStatus.CLOSED) throw new AppError(409, "TICKET_CLOSED", "Closed tickets do not accept replies");
    const message = await tx.ticketMessage.create({ data: { ticketId: id, authorUserId: userId, body: input.body }, select: messageSelect });
    const next = ticket.status === TicketStatus.WAITING_CUSTOMER ? TicketStatus.IN_PROGRESS : ticket.status === TicketStatus.RESOLVED ? TicketStatus.OPEN : null;
    if (next) {
      await tx.ticket.update({ where: { id }, data: { status: next, ...(ticket.status === TicketStatus.RESOLVED && { resolvedAt: null }) } });
      await tx.ticketHistory.create({ data: { ticketId: id, actorUserId: userId, action: "STATUS_CHANGED", oldValue: ticket.status, newValue: next } });
    }

    // Fan-out notifications to assigned agent + all active ADMIN/MANAGER
    const recipientIds: string[] = [];
    if (ticket.assignedAgentId) {
      const agent = await tx.user.findFirst({ where: { id: ticket.assignedAgentId, isActive: true }, select: { id: true } });
      if (agent) recipientIds.push(agent.id);
    }
    const adminsManagers = await tx.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.MANAGER] }, isActive: true },
      select: { id: true },
    });
    for (const u of adminsManagers) recipientIds.push(u.id);
    // Exclude the customer (userId) from the recipient list — they are the author
    const filtered = recipientIds.filter((rid) => rid !== userId);
    await createNotifications(tx, filtered, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${id}: ${ticket.subject}`, id);

    return { id: message.id, body: message.body, createdAt: message.createdAt, author: { id: message.author.id, name: message.author.name, kind: "CUSTOMER" as const } };
  });
}

function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
export const portalStatus = { map: statusMap, stored: storedStatuses };
