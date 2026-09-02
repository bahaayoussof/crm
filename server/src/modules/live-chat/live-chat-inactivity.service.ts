import { Channel, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { emitTicketUpdated, withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { LIVE_CHAT_INACTIVITY_BATCH_SIZE, LIVE_CHAT_INACTIVITY_MINUTES } from "./live-chat.config.js";

/**
 * Inactivity auto-resolve for LIVE_CHAT tickets.
 *
 * A recurring server-owned sweep (Vercel cron → `/api/internal/live-chat-inactivity`,
 * same `CRON_SECRET` bearer auth as the SLA monitor + task reminders). The server
 * is the sole authority for inactivity resolution — no client timer decides it.
 *
 * A chat is auto-resolved ONLY when ALL of these hold:
 *   - `channel === LIVE_CHAT`
 *   - status is active / non-terminal (never RESOLVED, never CLOSED)
 *   - `firstRespondedAt != null`  — it has already had ≥1 public staff reply.
 *     An UNANSWERED chat is never auto-resolved for inactivity; it stays active
 *     and keeps flowing through the existing SLA first-response / escalation
 *     automation. We do not punish the customer for slow support.
 *   - no public conversation activity for at least
 *     {@link LIVE_CHAT_INACTIVITY_MINUTES} minutes
 *
 * "Conversation inactivity" is derived from the newest `TicketMessage.createdAt`
 * (CUSTOMER or internal staff), NOT `Ticket.updatedAt` — internal notes,
 * assignment / priority / SLA / watcher changes and audit writes must never reset
 * the window. `TicketMessage` is the public-message relation only (internal notes
 * are the separate `TicketNote` model), so the `messages` predicate below is
 * exactly "newest public message".
 */
const ACTIVE_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_CUSTOMER,
  TicketStatus.ESCALATED,
] as const;

export interface LiveChatInactivityResult {
  inspected: number;
  resolved: number;
  generatedAt: string;
}

export async function runLiveChatInactivitySweep(now = new Date()): Promise<LiveChatInactivityResult> {
  return withRealtimeOutbox(async () => {
    const cutoff = new Date(now.getTime() - LIVE_CHAT_INACTIVITY_MINUTES * 60_000);

    // Bounded candidate query — never loads an unbounded set of tickets/messages
    // into memory. `messages: { none: { createdAt: { gt: cutoff } } }` pushes the
    // "newest message older than the window" test into the database.
    const candidates = await prisma.ticket.findMany({
      where: {
        channel: Channel.LIVE_CHAT,
        status: { in: [...ACTIVE_STATUSES] },
        firstRespondedAt: { not: null },
        messages: { none: { createdAt: { gt: cutoff } } },
      },
      take: LIVE_CHAT_INACTIVITY_BATCH_SIZE,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, status: true, assignedAgentId: true, customerId: true, teamId: true },
    });

    let resolved = 0;
    for (const ticket of candidates) {
      const didResolve = await prisma.$transaction(async (tx) => {
        // Final transactional eligibility recheck. The SAME predicate as the
        // candidate query is re-evaluated here as a conditional `updateMany`:
        //   - a new public message arriving after the candidate query (the
        //     message-race scenario) fails `messages: { none: … }` → count 0
        //   - a concurrent staff / customer resolve moves it out of the active
        //     statuses → count 0
        //   - a second cron invocation finds it already RESOLVED → not a
        //     candidate at all → no duplicate history / audit / realtime event
        const mutation = await tx.ticket.updateMany({
          where: {
            id: ticket.id,
            channel: Channel.LIVE_CHAT,
            status: { in: [...ACTIVE_STATUSES] },
            firstRespondedAt: { not: null },
            messages: { none: { createdAt: { gt: cutoff } } },
          },
          data: { status: TicketStatus.RESOLVED, resolvedAt: now },
        });
        if (mutation.count !== 1) return false;

        await tx.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            actorUserId: null,
            action: "STATUS_CHANGED",
            oldValue: ticket.status,
            newValue: TicketStatus.RESOLVED,
          },
        });
        await createAuditLog(
          {
            actorId: null,
            action: AUDIT_ACTIONS.TICKET_STATUS_CHANGED,
            entityType: AUDIT_ENTITY_TYPES.TICKET,
            entityId: ticket.id,
            changes: { status: { from: ticket.status, to: TicketStatus.RESOLVED } },
            metadata: {
              reason: "live_chat_inactivity_auto_resolve",
              inactivityMinutes: LIVE_CHAT_INACTIVITY_MINUTES,
            },
          },
          tx,
        );
        return true;
      });

      if (didResolve) {
        resolved += 1;
        // Same `ticket.updated` event the canonical workflow emits — connected
        // customer + staff clients invalidate and re-read. Emitted once per
        // ticket (guarded by the conditional update above).
        emitTicketUpdated({
          ticketId: ticket.id,
          assignedAgentId: ticket.assignedAgentId,
          customerId: ticket.customerId,
          teamId: ticket.teamId,
        });
      }
    }

    return { inspected: candidates.length, resolved, generatedAt: now.toISOString() };
  });
}

export const liveChatInactivityPolicy = { ACTIVE_STATUSES, LIVE_CHAT_INACTIVITY_MINUTES };
