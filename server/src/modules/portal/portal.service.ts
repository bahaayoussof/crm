import { Channel, Prisma, Role, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createNotifications } from "../notifications/notification.service.js";
import { requireConversationContent } from "../../shared/rich-text/conversation-content.js";
import { emitTicketMessageCreated, emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { customerReplyNotificationRecipientIds } from "../../shared/team/team-scope.js";
import { bindStagedAttachments } from "../attachments/attachment.service.js";
import { createCanonicalTicket } from "../tickets/create-canonical-ticket.js";
import type { PortalCreateTicketInput, PortalReplyInput, PortalStatus, PortalTicketListQuery } from "./portal.schema.js";

const listSelect = { id: true, subject: true, status: true, category: { select: { id: true, name: true } }, createdAt: true, updatedAt: true } satisfies Prisma.TicketSelect;
// "My Requests" table only — adds the customer-safe `priority` column/filter support.
// Kept separate from `listSelect` so overview / detail / create response shapes are unchanged.
const ticketListSelect = { ...listSelect, priority: true } satisfies Prisma.TicketSelect;
// CONV-047: contentFormat rides along so the client renders from persisted
// provenance instead of markup-sniffing the body.
const messageSelect = { id: true, body: true, createdAt: true, contentFormat: true, author: { select: { id: true, name: true, role: true } } } satisfies Prisma.TicketMessageSelect;
const statusMap: Record<TicketStatus, PortalStatus> = {
  OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", ESCALATED: "IN_PROGRESS",
  WAITING_CUSTOMER: "WAITING_FOR_YOU", RESOLVED: "RESOLVED", CLOSED: "CLOSED",
};
const storedStatuses: Record<PortalStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.OPEN], IN_PROGRESS: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED],
  WAITING_FOR_YOU: [TicketStatus.WAITING_CUSTOMER], RESOLVED: [TicketStatus.RESOLVED], CLOSED: [TicketStatus.CLOSED],
};

export async function customerIdFor(userId: string) {
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
  // Same post-commit outbox pattern as reply() below: connected staff (ADMIN —
  // the unrouted-ticket audience) get the canonical `ticket.updated` invalidation
  // signal once the create transaction commits; a rollback publishes nothing.
  // Portal creation stays unaudited (OD-3) — no AuditLog row here.
  return withRealtimeOutbox(async () => {
   const created = await prisma.$transaction(async (tx) => {
    if (input.categoryId) {
      const category = await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } });
      if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
    }
    const sla = await tx.slaRule.findFirst({ where: { priority: TicketPriority.MEDIUM, isActive: true } });
    // Portal-created tickets carry no Team at creation (teamId null). Per the
    // automatic-assignment core rule, a ticket with no Team is left unassigned
    // for ADMIN routing; auto-assignment runs later, from the canonical ticket
    // update flow, once an ADMIN routes it to a Team.
    // CONV-028/044 (OD-CC-7): exactly one canonical TICKET_CREATED AuditLog,
    // actorless even though a Portal customer initiated the request — but the
    // TicketHistory row keeps the customer's own actorUserId (historyActorId
    // override), same divergence as Live Chat.
    const canonical = await createCanonicalTicket({
      tx,
      data: { subject: input.subject, description: input.description, categoryId: input.categoryId ?? null,
        customerId, status: TicketStatus.OPEN, priority: TicketPriority.MEDIUM, channel: Channel.WEB,
        assignedAgentId: null, departmentId: null, branchId: null, createdAt: now,
        firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
        resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
      },
      actorId: null,
      historyActorId: userId,
      select: listSelect,
    });
    return ticketItem(canonical.ticket);
   });
   // Portal tickets are always unrouted + unassigned (server-owned) → audience is
   // ADMIN only via the unchanged canReceive routing.
   emitTicketUpdated({ ticketId: created.id, assignedAgentId: null, customerId, teamId: null });
   return created;
  });
}

export async function reply(id: string, input: PortalReplyInput, userId: string) {
  const customerId = await customerIdFor(userId);
  return withRealtimeOutbox(async () => {
   const { result, assignedAgentId, teamId } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({ where: { id, customerId }, select: { id: true, status: true, subject: true, assignedAgentId: true, teamId: true, channel: true } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
    if (ticket.status === TicketStatus.CLOSED) throw new AppError(409, "TICKET_CLOSED", "Closed tickets do not accept replies");
    // The Portal composer is the shared rich Lexical editor. Sanitize the HTML to
    // the support allowlist at this trust boundary (same as staff replies); the
    // `MessageBody` render guard re-sanitizes as defence in depth. Live Chat
    // customer messages ride this same endpoint, so provenance is derived from
    // the ticket's channel rather than always assumed to be PORTAL.
    const content = requireConversationContent({
      raw: input.body,
      format: "SANITIZED_HTML",
      source: ticket.channel === Channel.LIVE_CHAT ? "LIVE_CHAT" : "PORTAL",
    });
    const body = content.sanitizedHtml!;
    const message = await tx.ticketMessage.create({
      data: { ticketId: id, authorUserId: userId, body, contentFormat: content.contentFormat, contentSource: content.contentSource },
      select: messageSelect,
    });
    // CONV-041/049 — Portal/Live-Chat replies are always WEB/LIVE_CHAT channel,
    // so no outbound-attachment-capability rejection (CONV-042) applies here.
    if (input.attachmentIds?.length) {
      await bindStagedAttachments(tx, input.attachmentIds, { ticketId: id, messageId: message.id }, userId);
    }
    const next = ticket.status === TicketStatus.WAITING_CUSTOMER ? TicketStatus.IN_PROGRESS : ticket.status === TicketStatus.RESOLVED ? TicketStatus.OPEN : null;
    if (next) {
      await tx.ticket.update({ where: { id }, data: { status: next, ...(ticket.status === TicketStatus.RESOLVED && { resolvedAt: null }) } });
      await tx.ticketHistory.create({ data: { ticketId: id, actorUserId: userId, action: "STATUS_CHANGED", oldValue: ticket.status, newValue: next } });
    }

    // Targeted CUSTOMER_REPLY fan-out via the shared resolver (same rule for
    // every channel): assigned agent + ONLY this ticket's team manager +
    // watchers, deduplicated. No global ADMIN fan-out — an ADMIN is reached only
    // as a watcher, or via the unrouted/unassigned/unwatched fallback. The
    // replying customer is excluded.
    const recipients = await customerReplyNotificationRecipientIds(tx, {
      ticketId: id,
      teamId: ticket.teamId,
      assignedAgentId: ticket.assignedAgentId,
      excludeUserId: userId,
    });
    await createNotifications(tx, recipients, "CUSTOMER_REPLY", "Customer replied", `Customer replied to ticket #${id}: ${ticket.subject}`, id);

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
