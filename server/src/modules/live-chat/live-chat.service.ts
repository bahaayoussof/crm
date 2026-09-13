import { Channel, Prisma, TicketPriority, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { customerIdFor, ticketDetail } from "../portal/portal.service.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { createCanonicalTicket } from "../tickets/create-canonical-ticket.js";
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

/**
 * CONV-022/026 — session-key-only correlation (OD-CC-4/CC-GAP-22). A ticket is
 * resumable ONLY through its own `liveChatSessionKey`; customer identity never
 * selects a different session's ticket. RESOLVED/CLOSED are terminal even for
 * the key that reached them — a resume attempt with that key does not silently
 * resume the old ticket (the unique constraint would refuse a same-key insert
 * anyway; the client must rotate to a new key to start a fresh chat).
 */
async function ticketBySessionKey(sessionKey: string) {
  return prisma.ticket.findUnique({
    where: { liveChatSessionKey: sessionKey },
    select: { id: true, status: true, customerId: true },
  });
}

/**
 * `GET /api/portal/live-chat?sessionKey=...` — the live chat owned by this
 * session key, as a customer-safe ticket detail, or `null` so the client can
 * offer the Department start screen. No `sessionKey` and no match both return
 * `null` — there is no customer-identity fallback.
 */
export async function getActiveLiveChat(userId: string, sessionKey?: string) {
  const customerId = await customerIdFor(userId);
  if (!sessionKey) return null;
  const ticket = await ticketBySessionKey(sessionKey);
  if (!ticket || ticket.customerId !== customerId || !RESUMABLE_STATUSES.includes(ticket.status)) return null;
  return ticketDetail(ticket.id, userId);
}

/**
 * `POST /api/portal/live-chat` — resume the ticket owned by `input.sessionKey`
 * if it exists and is still resumable (the selected `departmentId` is
 * ignored; the chat is never re-routed), otherwise create a new LIVE_CHAT
 * ticket bound to that session key and routed to the chosen Department.
 *
 * The owning Team + branch are resolved from the selected Department inside the
 * same transaction (see `resolveLiveChatTeam`), so the first persisted row and
 * the first realtime event already carry the correct `teamId` — the ticket is
 * NEVER created with `teamId: null` and patched later. Returns the same
 * customer-safe detail shape as `getActiveLiveChat`.
 *
 * Concurrency-safe by construction (CONV-022, CC-GAP-22): the DB-level unique
 * `liveChatSessionKey` constraint is the sole concurrency boundary. Two
 * near-simultaneous creates for the SAME session key race on that constraint;
 * the loser's insert raises a unique violation, which is caught and re-read
 * as a resume — both callers return the same winning ticket, indistinguishable
 * in shape from an ordinary successful start/resume.
 */
export async function startLiveChat(userId: string, input: LiveChatStartInput) {
  const customerId = await customerIdFor(userId);
  const existing = await ticketBySessionKey(input.sessionKey);
  if (existing && existing.customerId === customerId && RESUMABLE_STATUSES.includes(existing.status)) {
    return ticketDetail(existing.id, userId);
  }
  if (existing) {
    // The key belongs to a terminal (RESOLVED/CLOSED) or foreign session —
    // never silently resumed. The client must rotate to a new session key.
    throw new AppError(409, "LIVE_CHAT_SESSION_ENDED", "This live chat session has ended. Start a new one.");
  }

  // Creating a new chat: the customer MUST have chosen a Department.
  if (!input.departmentId) {
    throw new AppError(400, "DEPARTMENT_REQUIRED", "Choose a department to start a live chat");
  }
  const departmentId = input.departmentId;
  const sessionKey = input.sessionKey;

  return withRealtimeOutbox(async () => {
    const now = new Date();
    // The P2002 recovery below MUST run outside this transaction: once a
    // Postgres statement inside an interactive transaction errors, the whole
    // transaction is aborted (25P02, "current transaction is aborted") and
    // every further query issued against that same `tx` fails — including a
    // same-tx recovery read. Catching here (after `$transaction` has already
    // rejected and rolled back) and re-reading via the top-level `prisma`
    // client uses a fresh connection/transaction instead.
    let created: { id: string; customerId: string; teamId: string | null; assignedAgentId: string | null; raced: boolean };
    try {
      created = await prisma.$transaction(async (tx) => {
        const { teamId, branchId } = await resolveLiveChatTeam(tx, departmentId);
        const sla = await tx.slaRule.findFirst({
          where: { priority: TicketPriority.MEDIUM, isActive: true },
        });
        // A live chat is created already routed to a Team (resolved from the
        // customer-selected Department), so automatic assignment can run
        // immediately — least-loaded eligible active agent on that Team. No
        // eligible agent -> the chat stays unassigned for the manager/admin.
        // CONV-044 (OD-CC-7): exactly one canonical TICKET_CREATED AuditLog,
        // actorless like every other non-staff creation path, even though the
        // authenticated customer initiated the request — TicketHistory keeps
        // the customer's own actorUserId via `historyActorId` (unchanged).
        const canonical = await createCanonicalTicket({
          tx,
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
            liveChatSessionKey: sessionKey,
            createdAt: now,
            firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
            resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
          },
          actorId: null,
          historyActorId: userId,
          autoAssign: true,
        });
        return { id: canonical.ticketId, customerId: canonical.customerId, teamId: canonical.teamId, assignedAgentId: canonical.assignedAgentId, raced: false as const };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Lost the race for this session key — the transaction above has
        // already rolled back; re-read the winner via a fresh top-level query.
        // The loser never created history/audit/assignment — only the
        // winner's createCanonicalTicket call did that, exactly once.
        const winner = await prisma.ticket.findUniqueOrThrow({
          where: { liveChatSessionKey: sessionKey },
          select: { id: true, customerId: true, teamId: true, assignedAgentId: true },
        });
        created = { ...winner, raced: true as const };
      } else {
        throw error;
      }
    }

    // The loser of the race never created history/audit/assignment/event —
    // only the winner's transaction did that, exactly once.
    if (!created.raced) {
      // The first public event already carries the resolved routing: with a
      // `teamId` it reaches that team's MANAGER + own-team-unassigned AGENTs +
      // ADMIN via the existing `teamId` audience. No live-chat-specific realtime
      // rule.
      emitTicketUpdated({
        ticketId: created.id,
        assignedAgentId: created.assignedAgentId,
        customerId: created.customerId,
        teamId: created.teamId,
      });
    }
    return ticketDetail(created.id, userId);
  });
}

/**
 * `POST /api/portal/live-chat/:ticketId/end` — the customer explicitly ends an
 * active live chat.
 *
 * V1 policy: `active -> RESOLVED` only. The customer end action NEVER moves a
 * chat to `CLOSED` (that stays part of the staff/system workflow), and NEVER
 * re-routes it — `departmentId` / `teamId` / assignment / conversation history
 * are all preserved. Afterwards the customer can start a brand-new live chat and
 * pick a Department again (a RESOLVED chat is terminal for `/portal/live-chat`).
 *
 * Reuses the canonical resolve mechanics: `status = RESOLVED` + `resolvedAt`, a
 * `STATUS_CHANGED` TicketHistory row (actor = the customer), and one audit-log
 * entry whose `metadata.reason` marks the customer as the resolution source. The
 * existing `ticket.updated` realtime event drives both the customer and staff
 * UIs via query invalidation — no bespoke notification.
 *
 * Safe under repeat / race:
 *   - already RESOLVED  → idempotent 200, no second history/audit/event
 *   - CLOSED            → 409 TICKET_CLOSED (never reopened by this action)
 *   - not a LIVE_CHAT   → 400 NOT_A_LIVE_CHAT
 *   - not owned by the caller → 404 (ownership is in the `where`)
 * The transition is a conditional `updateMany` guarded by the active statuses, so
 * a concurrent staff/inactivity resolve produces exactly one winner.
 */
export async function endLiveChat(userId: string, ticketId: string) {
  const customerId = await customerIdFor(userId);
  return withRealtimeOutbox(async () => {
    const outcome = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, customerId },
        select: { id: true, status: true, channel: true, assignedAgentId: true, teamId: true },
      });
      if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
      if (ticket.channel !== Channel.LIVE_CHAT) {
        throw new AppError(400, "NOT_A_LIVE_CHAT", "This conversation is not a live chat");
      }
      // Idempotent: a chat already resolved by the customer, staff, or the
      // inactivity sweep is a no-op success.
      if (ticket.status === TicketStatus.RESOLVED) return { changed: false, ticket };
      // A closed chat is terminal — the customer end action must not reopen it.
      if (ticket.status === TicketStatus.CLOSED) {
        throw new AppError(409, "TICKET_CLOSED", "This chat is already closed");
      }

      const now = new Date();
      const mutation = await tx.ticket.updateMany({
        where: { id: ticketId, customerId, channel: Channel.LIVE_CHAT, status: { in: RESUMABLE_STATUSES } },
        data: { status: TicketStatus.RESOLVED, resolvedAt: now },
      });
      if (mutation.count !== 1) return { changed: false, ticket };

      await tx.ticketHistory.create({
        data: {
          ticketId,
          actorUserId: userId,
          action: "STATUS_CHANGED",
          oldValue: ticket.status,
          newValue: TicketStatus.RESOLVED,
        },
      });
      await createAuditLog(
        {
          actorId: userId,
          action: AUDIT_ACTIONS.TICKET_STATUS_CHANGED,
          entityType: AUDIT_ENTITY_TYPES.TICKET,
          entityId: ticketId,
          changes: { status: { from: ticket.status, to: TicketStatus.RESOLVED } },
          metadata: { reason: "live_chat_ended_by_customer" },
        },
        tx,
      );
      return { changed: true, ticket };
    });

    if (outcome.changed) {
      emitTicketUpdated({
        ticketId,
        assignedAgentId: outcome.ticket.assignedAgentId,
        customerId,
        teamId: outcome.ticket.teamId,
      });
    }
    return ticketDetail(ticketId, userId);
  });
}

export const liveChatInternals = { RESUMABLE_STATUSES, NEW_CHAT_SUBJECT, resolveLiveChatTeam };
