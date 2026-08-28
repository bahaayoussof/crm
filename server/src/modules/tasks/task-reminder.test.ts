import { TaskStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  taskFindMany: vi.fn(),
  taskUpdateMany: vi.fn(),
  notificationCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const tx = {
    task: { updateMany: mocks.taskUpdateMany },
    notification: { createMany: mocks.notificationCreateMany },
  };
  return {
    prisma: {
      task: { findMany: mocks.taskFindMany },
      $transaction: mocks.transaction.mockImplementation((callback: (value: typeof tx) => unknown) =>
        callback(tx),
      ),
    },
  };
});

import { app } from "../../app.js";
import { env } from "../../config/env.js";
import { runTaskReminders, TASK_REMINDER_BATCH_SIZE } from "./task-reminder.service.js";

const secret = "cron-test-secret-that-is-at-least-32-characters";
const setCronSecret = (value: string | undefined) => {
  (env as { CRON_SECRET?: string }).CRON_SECRET = value;
};

describe("task reminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCronSecret(secret);
    mocks.transaction.mockImplementation((callback) =>
      callback({
        task: { updateMany: mocks.taskUpdateMany },
        notification: { createMany: mocks.notificationCreateMany },
      }),
    );
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.taskUpdateMany.mockResolvedValue({ count: 1 });
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
  });

  describe("cron authentication", () => {
    it("returns 503 when the scheduler secret is not configured", async () => {
      setCronSecret(undefined);
      const response = await request(app).get("/api/internal/task-reminders");
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("CRON_NOT_CONFIGURED");
    });

    it("rejects missing and wrong bearer tokens", async () => {
      expect((await request(app).get("/api/internal/task-reminders")).status).toBe(401);
      expect(
        (await request(app).get("/api/internal/task-reminders").set("Authorization", "Bearer wrong")).status,
      ).toBe(401);
      expect(mocks.taskFindMany).not.toHaveBeenCalled();
    });

    it("runs with the cron secret and returns only an execution summary", async () => {
      const response = await request(app)
        .get("/api/internal/task-reminders")
        .set("Authorization", `Bearer ${secret}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ inspected: 0, reminded: 0 });
      expect(response.body.data.generatedAt).toEqual(expect.any(String));
    });
  });

  it("only selects OPEN, un-reminded, past-due tasks in a bounded batch", async () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    await runTaskReminders(now);
    expect(mocks.taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: TaskStatus.OPEN, remindedAt: null, dueAt: { not: null, lte: now } },
        take: TASK_REMINDER_BATCH_SIZE,
        orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("notifies the assignee once and stamps remindedAt for each due task", async () => {
    const now = new Date("2026-08-28T12:00:00.000Z");
    mocks.taskFindMany.mockResolvedValue([
      { id: "task-1", title: "Call the customer back", assigneeId: "agent-1" },
      { id: "task-2", title: "Escalate refund", assigneeId: "agent-2" },
    ]);

    const result = await runTaskReminders(now);

    expect(result).toMatchObject({ inspected: 2, reminded: 2 });
    expect(mocks.taskUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "task-1", status: TaskStatus.OPEN, remindedAt: null },
      data: { remindedAt: now },
    });
    expect(mocks.notificationCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: "agent-1",
            type: "TASK_REMINDER",
            taskId: "task-1",
            ticketId: null,
          }),
        ],
      }),
    );
  });

  it("does not notify when the guarded update loses a race", async () => {
    mocks.taskFindMany.mockResolvedValue([{ id: "task-1", title: "Stale", assigneeId: "agent-1" }]);
    mocks.taskUpdateMany.mockResolvedValue({ count: 0 });

    const result = await runTaskReminders(new Date("2026-08-28T12:00:00.000Z"));

    expect(result.reminded).toBe(0);
    expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
  });
});
