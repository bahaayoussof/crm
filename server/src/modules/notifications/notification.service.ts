import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { NotificationQuery } from "./notification.schema.js";

/** Safe projection — never expose other users' data. */
const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  ticketId: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export async function listNotifications(userId: string, query: NotificationQuery) {
  const readFilter =
    query.read === "true"
      ? { readAt: { not: null } }
      : query.read === "false"
        ? { readAt: null }
        : undefined;

  const where: Prisma.NotificationWhereInput = { userId, ...readFilter };
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      select: notificationSelect,
    }),
    prisma.notification.count({ where }),
  ]);
  return {
    data: records,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, readAt: null } });
  return { count };
}

export async function markRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, readAt: true },
  });
  if (!notification) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
  // Idempotent: already read → return as-is
  if (notification.readAt !== null) {
    const current = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: notificationSelect,
    });
    return current!;
  }
  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: notificationSelect,
  });
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: count };
}

/**
 * Create one or more notifications inside an existing transaction.
 *
 * Always accepts a Prisma.TransactionClient so the insertion is atomic
 * with the event that triggered it. Uses createMany for efficiency.
 * Deduplicates recipient IDs before insertion.
 */
export async function createNotifications(
  tx: Prisma.TransactionClient,
  recipients: string[], // user IDs, deduplicated before calling
  type: string,
  title: string,
  message: string,
  ticketId: string,
) {
  const unique = [...new Set(recipients)].filter(Boolean);
  if (unique.length === 0) return;
  const now = new Date();
  await tx.notification.createMany({
    data: unique.map((userId) => ({ userId, type, title, message, ticketId, createdAt: now })),
  });
}
