import { TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { createNotifications } from "../notifications/notification.service.js";

/** Bounded batch per sweep so a backlog cannot stall the cron request. */
export const TASK_REMINDER_BATCH_SIZE = 100;

export interface TaskReminderResult {
  inspected: number;
  reminded: number;
  generatedAt: string;
}

/**
 * Idempotent due-task reminder sweep.
 *
 * Finds OPEN tasks whose `dueAt` has passed and that have not been reminded yet
 * (`remindedAt IS NULL`), notifies the assignee once, and stamps `remindedAt`.
 * `remindedAt` is reset by the task service whenever `dueAt`, the assignee, or a
 * DONE->OPEN reopen changes the reminder's meaning, so a task can legitimately
 * be reminded again after such an edit.
 */
export async function runTaskReminders(now = new Date()): Promise<TaskReminderResult> {
  const due = await prisma.task.findMany({
    where: {
      status: TaskStatus.OPEN,
      remindedAt: null,
      dueAt: { not: null, lte: now },
    },
    take: TASK_REMINDER_BATCH_SIZE,
    orderBy: [{ dueAt: "asc" }, { id: "asc" }],
    select: { id: true, title: true, assigneeId: true },
  });

  let reminded = 0;

  for (const task of due) {
    const sent = await prisma.$transaction(async (tx) => {
      const mutation = await tx.task.updateMany({
        where: { id: task.id, status: TaskStatus.OPEN, remindedAt: null },
        data: { remindedAt: now },
      });
      if (mutation.count !== 1) return false;

      await createNotifications(
        tx,
        [task.assigneeId],
        "TASK_REMINDER",
        "Task due",
        `Your task is due: ${task.title}`,
        null,
        task.id,
      );
      return true;
    });

    if (sent) reminded += 1;
  }

  return { inspected: due.length, reminded, generatedAt: now.toISOString() };
}
