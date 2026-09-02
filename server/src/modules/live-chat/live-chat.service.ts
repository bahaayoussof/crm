import { Channel, Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { customerIdFor, ticketDetail } from "../portal/portal.service.js";

/**
 * Live Chat is NOT a second messaging system. A live chat is an ordinary Ticket
 * with `channel = LIVE_CHAT`; its messages are `TicketMessage` rows written by the
 * canonical portal reply / staff reply flows. This module only orchestrates the
 * customer-portal bootstrap: resume the customer's active live chat, or open a
 * new one.
 *
 * "Active / resumable" = the most recent LIVE_CHAT ticket owned by the
 * authenticated customer whose status is not terminal. Terminal = RESOLVED or
 * CLOSED (a resolved/closed chat is read-only in the portal; the customer starts
 * a fresh chat instead). This mirrors the portal ticket-status model exactly —
 * no live-chat-specific lifecycle.
 */
const RESUMABLE_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
];

const NEW_CHAT_SUBJECT = "Live chat";
const NEW_CHAT_DESCRIPTION = "Live chat session started from the customer portal.";

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Canonical team routing for a BRAND-NEW live chat.
 *
 * Live Chat has no routing form of its own and this fix does not add one. It
 * reuses the only deterministic team signal the CRM already records for a
 * customer: the team that the customer's own prior tickets were routed to. That
 * is priority #1 of the routing spec — "explicit Team routing already available
 * for the customer context". The domain model has no Customer→Branch/Department
 * link and no Category→Team link (so spec #2/#3 cannot apply), and there is no
 * auto-assignment/SLA routing service (#4). No match → `teamId` stays null (#5,
 * the fallback: ADMIN-only, chat creation never blocked).
 *
 * Deterministic — newest routed ticket wins (`createdAt` desc, `id` asc); no
 * random team is ever chosen. An inactive owning team is skipped so a fresh chat
 * is never routed onto a dead team. Routing to a team never assigns an agent.
 */
async function resolveLiveChatTeamId(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<string | null> {
  const prior = await tx.ticket.findFirst({
    where: { customerId, teamId: { not: null }, team: { is: { isActive: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { teamId: true },
  });
  return prior?.teamId ?? null;
}

async function resumableLiveChatId(customerId: string): Promise<string | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { customerId, channel: Channel.LIVE_CHAT, status: { in: RESUMABLE_STATUSES } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true },
  });
  return ticket?.id ?? null;
}

/**
 * `GET /api/portal/live-chat` — the resumable live chat for the authenticated
 * customer as a customer-safe ticket detail, or `null` so the client can offer to
 * start one. Never accepts a `customerId` from the caller.
 */
export async function getActiveLiveChat(userId: string) {
  const customerId = await customerIdFor(userId);
  const id = await resumableLiveChatId(customerId);
  return id ? ticketDetail(id, userId) : null;
}

/**
 * `POST /api/portal/live-chat` — resume the customer's active live chat if one
 * exists, otherwise create a new LIVE_CHAT ticket using the existing ticket
 * defaults (status OPEN, priority MEDIUM, MEDIUM SLA snapshot, TICKET_CREATED
 * history). The owning team is resolved from the customer's existing routed
 * tickets (see `resolveLiveChatTeamId`) inside the same transaction, so the first
 * persisted row and the first realtime event already carry the correct `teamId`;
 * it stays null only when no routing signal exists. Returns the same
 * customer-safe detail shape as `getActiveLiveChat`.
 */
export async function startLiveChat(userId: string) {
  const customerId = await customerIdFor(userId);
  const existing = await resumableLiveChatId(customerId);
  if (existing) return ticketDetail(existing, userId);

  return withRealtimeOutbox(async () => {
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const sla = await tx.slaRule.findFirst({
        where: { priority: TicketPriority.MEDIUM, isActive: true },
      });
      const teamId = await resolveLiveChatTeamId(tx, customerId);
      const ticket = await tx.ticket.create({
        data: {
          subject: NEW_CHAT_SUBJECT,
          description: NEW_CHAT_DESCRIPTION,
          customerId,
          status: TicketStatus.OPEN,
          priority: TicketPriority.MEDIUM,
          channel: Channel.LIVE_CHAT,
          assignedAgentId: null,
          categoryId: null,
          departmentId: null,
          branchId: null,
          teamId,
          createdAt: now,
          firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
          resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
        },
        select: { id: true, customerId: true, teamId: true },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          actorUserId: userId,
          action: "TICKET_CREATED",
          newValue: TicketStatus.OPEN,
        },
      });
      return ticket;
    });

    // The first public event already carries the resolved routing: with a
    // `teamId` it reaches that team's MANAGER + own-team-unassigned AGENTs +
    // ADMIN via the existing `teamId` audience; unrouted (null) it stays
    // ADMIN-only, exactly like any other unrouted ticket. No live-chat-specific
    // realtime rule.
    emitTicketUpdated({
      ticketId: created.id,
      assignedAgentId: null,
      customerId: created.customerId,
      teamId: created.teamId,
    });
    return ticketDetail(created.id, userId);
  });
}

export const liveChatInternals = { RESUMABLE_STATUSES, NEW_CHAT_SUBJECT, resolveLiveChatTeamId };
