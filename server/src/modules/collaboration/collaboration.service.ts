import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createNotifications } from "../notifications/notification.service.js";
import { ticketVisibilityWhere, type TicketActor } from "../tickets/ticket-visibility.js";
import type { MentionableQuery } from "./collaboration.schema.js";

// feature/team-collaboration (ADR-032) — internal-only mentions + watchers.
// All collaboration data is scoped to internal roles; the Customer Portal never
// reaches this module.

const INTERNAL_ROLES: Role[] = [Role.ADMIN, Role.MANAGER, Role.AGENT];

/** Application-level Notification.type values (kept as plain strings — no enum). */
export const NOTIFICATION_MENTION = "TICKET_MENTION";
export const NOTIFICATION_WATCH_ACTIVITY = "TICKET_WATCH_ACTIVITY";

// ---------------------------------------------------------------------------
// Mention parsing
// ---------------------------------------------------------------------------

// Matches `@[Display Name](userId)`. Bounded quantifiers, no nesting → linear
// time, no catastrophic backtracking. Names never resolve by text; the id is
// authoritative and duplicate-name-safe.
const MENTION_TOKEN = /@\[([^\]\r\n]{1,120})\]\(([A-Za-z0-9_-]{1,64})\)/g;

export interface ParsedMention {
  userId: string;
  name: string;
}

/** Extract valid `@[Name](userId)` tokens, deduplicated by user id, ignoring
 * malformed tokens. Does not touch the stored text. */
export function parseMentions(body: string): ParsedMention[] {
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const name = (match[1] ?? "").trim();
    const userId = match[2] ?? "";
    if (!name || !userId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({ userId, name });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mentionable users lookup
// ---------------------------------------------------------------------------

export async function listMentionableUsers(query: MentionableQuery) {
  const search = query.search?.trim();
  const where: Prisma.UserWhereInput = {
    isActive: true,
    role: { in: INTERNAL_ROLES },
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return prisma.user.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 10,
    select: { id: true, name: true, email: true },
  });
}

// ---------------------------------------------------------------------------
// Watcher helpers — transaction-scoped, used by ticket.service / portal.service
// ---------------------------------------------------------------------------

/** Idempotently add watchers inside an existing transaction. */
export async function addWatchers(
  tx: Prisma.TransactionClient,
  ticketId: string,
  userIds: string[],
) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  await tx.ticketWatcher.createMany({
    data: unique.map((userId) => ({ ticketId, userId })),
    skipDuplicates: true,
  });
}

export interface WatcherFanOut {
  ticketId: string;
  actorUserId: string;
  type: string;
  title: string;
  message: string;
  /** Recipients already notified by the triggering event — never double-notify. */
  excludeUserIds?: string[];
}

/**
 * Notify every watcher of a ticket, minus the actor and any explicitly excluded
 * recipients, deduplicated.
 *
 * Transaction semantics: this runs inside the caller's `$transaction`, matching
 * how every other in-app notification is written in this codebase (assignment,
 * escalation, SLA automation, tasks — ADR-029). Notification persistence is
 * deliberately transactional here: if it throws, the triggering mutation rolls
 * back. The fan-out is one bounded `findMany` + one `createMany` per ticket, so
 * the added failure surface is minimal and consistent with the existing model.
 */
export async function notifyWatchers(tx: Prisma.TransactionClient, input: WatcherFanOut) {
  const excluded = new Set(
    [input.actorUserId, ...(input.excludeUserIds ?? [])].filter(Boolean),
  );
  const watchers = await tx.ticketWatcher.findMany({
    where: { ticketId: input.ticketId },
    select: { userId: true },
  });
  const recipients = [...new Set(watchers.map((w) => w.userId))].filter(
    (id) => !excluded.has(id),
  );
  if (recipients.length === 0) return;
  await createNotifications(
    tx,
    recipients,
    input.type,
    input.title,
    input.message,
    input.ticketId,
  );
}

// ---------------------------------------------------------------------------
// Note mentions — called from ticket.service.addTicketNote inside its transaction
// ---------------------------------------------------------------------------

export interface ApplyNoteMentionsInput {
  ticketId: string;
  noteId: string;
  body: string;
  authorUserId: string;
  authorName: string;
  ticketSubject: string;
}

/**
 * Resolve `@[Name](id)` mentions in a new internal note:
 *  1. parse ids from the body
 *  2. keep only active internal users, minus the author
 *  3. write `TicketMention` rows (deduped by the `(noteId, mentionedUserId)` unique)
 *  4. auto-watch the note author + every valid mentioned user (idempotent)
 *  5. send one `TICKET_MENTION` notification per mentioned user
 *
 * Returns the mentioned user ids so the caller can exclude them from the generic
 * watcher fan-out for the same note (no mention + watcher double-notification).
 */
export async function applyNoteMentions(
  tx: Prisma.TransactionClient,
  input: ApplyNoteMentionsInput,
): Promise<string[]> {
  const requestedIds = parseMentions(input.body)
    .map((m) => m.userId)
    .filter((id) => id !== input.authorUserId);

  let mentionedIds: string[] = [];
  if (requestedIds.length > 0) {
    const users = await tx.user.findMany({
      where: { id: { in: requestedIds }, isActive: true, role: { in: INTERNAL_ROLES } },
      select: { id: true },
    });
    mentionedIds = users.map((u) => u.id);
  }

  if (mentionedIds.length > 0) {
    await tx.ticketMention.createMany({
      data: mentionedIds.map((mentionedUserId) => ({
        noteId: input.noteId,
        mentionedUserId,
        ticketId: input.ticketId,
      })),
      skipDuplicates: true,
    });
  }

  // The note author always follows the ticket after commenting; mentioned users
  // are auto-subscribed. Assignees / admins / managers are NOT auto-watched.
  await addWatchers(tx, input.ticketId, [input.authorUserId, ...mentionedIds]);

  if (mentionedIds.length > 0) {
    await createNotifications(
      tx,
      mentionedIds,
      NOTIFICATION_MENTION,
      "You were mentioned",
      `${input.authorName} mentioned you on ticket #${input.ticketId}: ${input.ticketSubject}`,
      input.ticketId,
    );
  }

  return mentionedIds;
}

// ---------------------------------------------------------------------------
// Watcher endpoints
// ---------------------------------------------------------------------------

async function assertTicketVisible(ticketId: string, actor: TicketActor) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor) },
    select: { id: true },
  });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
}

export async function listWatchers(ticketId: string, actor: TicketActor) {
  await assertTicketVisible(ticketId, actor);
  return prisma.ticketWatcher.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getWatchState(ticketId: string, userId: string) {
  const [watcherCount, mine] = await Promise.all([
    prisma.ticketWatcher.count({ where: { ticketId } }),
    prisma.ticketWatcher.findFirst({ where: { ticketId, userId }, select: { id: true } }),
  ]);
  return { watching: Boolean(mine), watcherCount };
}

export async function watchTicket(ticketId: string, actor: TicketActor) {
  await assertTicketVisible(ticketId, actor);
  await prisma.ticketWatcher.createMany({
    data: [{ ticketId, userId: actor.userId }],
    skipDuplicates: true,
  });
  return getWatchState(ticketId, actor.userId);
}

export async function unwatchTicket(ticketId: string, actor: TicketActor) {
  await assertTicketVisible(ticketId, actor);
  // Idempotent: deleting an absent watcher row is a no-op success.
  await prisma.ticketWatcher.deleteMany({ where: { ticketId, userId: actor.userId } });
  return getWatchState(ticketId, actor.userId);
}
