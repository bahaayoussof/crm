import { Channel, Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { customerIdFor, ticketDetail } from "../portal/portal.service.js";
import type { LiveChatStartInput } from "./live-chat.schema.js";

/**
 * Live Chat is NOT a second messaging system. A live chat is an ordinary Ticket
 * with `channel = LIVE_CHAT`; its messages are `TicketMessage` rows written by the
 * canonical portal reply / staff reply flows. This module only orchestrates the
 * customer-portal bootstrap: resume the customer's active live chat, or open a
 * new one that the customer has explicitly routed to a Department.
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
 * Customer-safe Department reference data for the "start a live chat" screen.
 *
 * A Department is routable for Live Chat only when it is BOTH active AND has at
 * least one active Team to receive the chat (`resolveLiveChatTeam` would
 * otherwise reject the start). The filter is enforced here on the server — the
 * client never decides which Departments are valid.
 *
 * Only `id` + `name` are returned. No branch, manager, team, member, ticket
 * count or audit metadata is exposed to the customer.
 */
export async function listLiveChatDepartments() {
  const departments = await prisma.department.findMany({
    where: { isActive: true, teams: { some: { isActive: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
  return departments;
}

/**
 * Resolve the owning Team for a brand-new live chat inside the Department the
 * customer just chose. The customer's own ticket history is NEVER consulted —
 * their current intent (the selected Department) is the only routing signal.
 *
 * Rules:
 *   1. the Department must exist and be active     → 404 / 400 otherwise
 *   2. consider ONLY teams with `departmentId === selected` AND `isActive`
 *   3. a `teamId` is never accepted from the customer
 *   4. a Team is never selected outside the chosen Department
 *
 * Multiple active teams in one Department: the CRM has no explicit "default
 * team" concept (no such column/flag on `Team`), so V1 uses a documented
 * deterministic rule — the OLDEST active team wins (`createdAt` asc, then `id`
 * asc as a stable tiebreak). No randomness, no round-robin, no load balancing,
 * no presence inspection.
 *
 * Department active but with zero active teams → `LIVE_CHAT_DEPARTMENT_UNAVAILABLE`
 * (customer-safe "support currently unavailable"); the chat is NOT created and
 * is NOT silently routed to an unrelated team.
 */
async function resolveLiveChatTeam(
  tx: Prisma.TransactionClient,
  departmentId: string,
): Promise<{ teamId: string; branchId: string | null }> {
  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { id: true, isActive: true, branchId: true },
  });
  if (!department) {
    throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
  }
  if (!department.isActive) {
    throw new AppError(400, "DEPARTMENT_INACTIVE", "This department is not available for live chat");
  }

  const team = await tx.team.findFirst({
    where: { departmentId, isActive: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  if (!team) {
    // Enough internal context to diagnose a mis-configured Department without
    // leaking team structure to the customer.
    console.warn(
      `[live-chat] no active team for department ${departmentId} — start rejected as LIVE_CHAT_DEPARTMENT_UNAVAILABLE`,
    );
    throw new AppError(
      503,
      "LIVE_CHAT_DEPARTMENT_UNAVAILABLE",
      "Live chat support is currently unavailable for this department. Please try another department or open a ticket.",
    );
  }

  return { teamId: team.id, branchId: department.branchId };
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
 * customer as a customer-safe ticket detail, or `null` so the client can offer
 * the Department start screen. Never accepts a `customerId` from the caller.
 */
export async function getActiveLiveChat(userId: string) {
  const customerId = await customerIdFor(userId);
  const id = await resumableLiveChatId(customerId);
  return id ? ticketDetail(id, userId) : null;
}

/**
 * `POST /api/portal/live-chat` — resume the customer's active live chat if one
 * exists (the selected `departmentId` is ignored; the chat is never re-routed),
 * otherwise create a new LIVE_CHAT ticket routed to the chosen Department.
 *
 * The owning Team + branch are resolved from the selected Department inside the
 * same transaction (see `resolveLiveChatTeam`), so the first persisted row and
 * the first realtime event already carry the correct `teamId` — the ticket is
 * NEVER created with `teamId: null` and patched later. Returns the same
 * customer-safe detail shape as `getActiveLiveChat`.
 *
 * Create-or-resume is preserved: the resumable check runs first and short-
 * circuits, so two near-simultaneous starts do not both create a chat.
 */
export async function startLiveChat(userId: string, input: LiveChatStartInput) {
  const customerId = await customerIdFor(userId);
  const existing = await resumableLiveChatId(customerId);
  if (existing) return ticketDetail(existing, userId);

  // Creating a new chat: the customer MUST have chosen a Department. (Optional at
  // the schema layer only so a resume POST can carry no body.)
  if (!input.departmentId) {
    throw new AppError(400, "DEPARTMENT_REQUIRED", "Choose a department to start a live chat");
  }
  const departmentId = input.departmentId;

  return withRealtimeOutbox(async () => {
    const now = new Date();
    const created = await prisma.$transaction(async (tx) => {
      const { teamId, branchId } = await resolveLiveChatTeam(tx, departmentId);
      const sla = await tx.slaRule.findFirst({
        where: { priority: TicketPriority.MEDIUM, isActive: true },
      });
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
          departmentId,
          branchId,
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
    // ADMIN via the existing `teamId` audience. No live-chat-specific realtime
    // rule.
    emitTicketUpdated({
      ticketId: created.id,
      assignedAgentId: null,
      customerId: created.customerId,
      teamId: created.teamId,
    });
    return ticketDetail(created.id, userId);
  });
}

export const liveChatInternals = { RESUMABLE_STATUSES, NEW_CHAT_SUBJECT, resolveLiveChatTeam };
