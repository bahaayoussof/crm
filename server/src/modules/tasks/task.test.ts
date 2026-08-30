import { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  taskFindMany: vi.fn(),
  taskCount: vi.fn(),
  taskFindFirst: vi.fn(),
  taskCreate: vi.fn(),
  taskUpdate: vi.fn(),
  taskDelete: vi.fn(),
  userFindFirst: vi.fn(),
  ticketFindFirst: vi.fn(),
  notificationCreateMany: vi.fn(),
}));

vi.mock("../../config/prisma.js", () => {
  const task = {
    findMany: mocks.taskFindMany,
    count: mocks.taskCount,
    findFirst: mocks.taskFindFirst,
    create: mocks.taskCreate,
    update: mocks.taskUpdate,
    delete: mocks.taskDelete,
  };
  const tx = { task, notification: { createMany: mocks.notificationCreateMany } };
  return {
    prisma: {
      task,
      user: { findFirst: mocks.userFindFirst },
      ticket: { findFirst: mocks.ticketFindFirst },
      $transaction: vi.fn((arg: unknown) =>
        typeof arg === "function"
          ? (arg as (t: typeof tx) => unknown)(tx)
          : Promise.all(arg as Promise<unknown>[])),
    },
  };
});

import { app } from "../../app.js";
import { createAccessToken } from "../auth/auth-token.js";

const token = (id: string, role: Role) => createAccessToken({ id, role });
const adminToken = token("admin-1", Role.ADMIN);
const managerToken = token("manager-1", Role.MANAGER);
const agentToken = token("agent-1", Role.AGENT);
const customerToken = token("customer-1", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const now = new Date("2026-08-28T12:00:00.000Z");

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: "task-1",
  title: "Follow up with customer",
  description: null,
  status: "OPEN",
  dueAt: null,
  remindedAt: null,
  ticketId: null,
  creatorId: "admin-1",
  assigneeId: "admin-1",
  createdAt: now,
  updatedAt: now,
  creator: { id: "admin-1", name: "Admin User" },
  assignee: { id: "admin-1", name: "Admin User" },
  ticket: null,
  ...overrides,
});

describe("tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.taskFindMany.mockResolvedValue([]);
    mocks.taskCount.mockResolvedValue(0);
    mocks.taskCreate.mockResolvedValue(taskRow());
    mocks.taskUpdate.mockResolvedValue(taskRow());
    mocks.taskDelete.mockResolvedValue(taskRow());
    mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
  });

  describe("authorization", () => {
    it("rejects unauthenticated requests on every route", async () => {
      expect((await request(app).get("/api/tasks")).status).toBe(401);
      expect((await request(app).get("/api/tasks/task-1")).status).toBe(401);
      expect((await request(app).post("/api/tasks").send({ title: "A task" })).status).toBe(401);
      expect((await request(app).patch("/api/tasks/task-1").send({ status: "DONE" })).status).toBe(401);
      expect((await request(app).delete("/api/tasks/task-1")).status).toBe(401);
    });

    it("rejects CUSTOMER from every route", async () => {
      expect((await request(app).get("/api/tasks").set(auth(customerToken))).status).toBe(403);
      expect((await request(app).get("/api/tasks/task-1").set(auth(customerToken))).status).toBe(403);
      expect(
        (await request(app).post("/api/tasks").set(auth(customerToken)).send({ title: "A task" })).status,
      ).toBe(403);
      expect(
        (await request(app).patch("/api/tasks/task-1").set(auth(customerToken)).send({ status: "DONE" })).status,
      ).toBe(403);
      expect((await request(app).delete("/api/tasks/task-1").set(auth(customerToken))).status).toBe(403);
    });
  });

  describe("list", () => {
    it("does not scope tasks for ADMIN/MANAGER", async () => {
      await request(app).get("/api/tasks").set(auth(managerToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.OR).toBeUndefined();
    });

    it("scopes an AGENT to tasks they created or are assigned", async () => {
      await request(app).get("/api/tasks").set(auth(agentToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([{ creatorId: "agent-1" }, { assigneeId: "agent-1" }]);
    });

    it("applies a case-insensitive title/description search", async () => {
      await request(app).get("/api/tasks?search=refund").set(auth(adminToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { title: { contains: "refund", mode: "insensitive" } },
        { description: { contains: "refund", mode: "insensitive" } },
      ]);
    });

    it("ignores an assigneeId filter from an AGENT", async () => {
      await request(app).get("/api/tasks?assigneeId=other-agent").set(auth(agentToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.assigneeId).toBeUndefined();
    });

    it("honours an assigneeId filter from a MANAGER", async () => {
      await request(app).get("/api/tasks?assigneeId=agent-9").set(auth(managerToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.assigneeId).toBe("agent-9");
    });

    it("defaults to limit=15 and takes 15 in findMany", async () => {
      mocks.taskFindMany.mockResolvedValue([]);
      mocks.taskCount.mockResolvedValue(0);
      const response = await request(app).get("/api/tasks").set(auth(adminToken));
      expect(response.status).toBe(200);
      expect(response.body.meta.limit).toBe(15);
      expect(mocks.taskFindMany.mock.calls[0][0].take).toBe(15);
    });

    it("returns pagination meta", async () => {
      mocks.taskFindMany.mockResolvedValue([taskRow()]);
      mocks.taskCount.mockResolvedValue(3);
      const response = await request(app).get("/api/tasks?limit=2").set(auth(adminToken));
      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it("rejects an unknown query parameter", async () => {
      const response = await request(app).get("/api/tasks?bogus=1").set(auth(adminToken));
      expect(response.status).toBe(400);
    });
  });

  describe("get one", () => {
    it("returns 404 when the task is not visible", async () => {
      mocks.taskFindFirst.mockResolvedValue(null);
      const response = await request(app).get("/api/tasks/task-x").set(auth(agentToken));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("returns the task with a safe assignee projection", async () => {
      mocks.taskFindFirst.mockResolvedValue(taskRow());
      const response = await request(app).get("/api/tasks/task-1").set(auth(adminToken));
      expect(response.status).toBe(200);
      expect(response.body.data.assignee).toEqual({ id: "admin-1", name: "Admin User" });
      expect(response.body.data.assignee).not.toHaveProperty("email");
    });
  });

  describe("create", () => {
    it("self-assigns and does not notify when no assignee is supplied", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Prepare report" });
      expect(response.status).toBe(201);
      expect(mocks.taskCreate.mock.calls[0][0].data).toMatchObject({
        creatorId: "admin-1",
        assigneeId: "admin-1",
      });
      expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
    });

    it("notifies the assignee when ADMIN assigns to an active agent", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "agent-7" });
      mocks.taskCreate.mockResolvedValue(taskRow({ id: "task-9", assigneeId: "agent-7" }));
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Call the customer", assigneeId: "agent-7" });
      expect(response.status).toBe(201);
      const payload = mocks.notificationCreateMany.mock.calls[0][0].data[0];
      expect(payload).toMatchObject({ userId: "agent-7", type: "TASK_ASSIGNED", taskId: "task-9", ticketId: null });
    });

    it("rejects an assignee that is not an active agent", async () => {
      mocks.userFindFirst.mockResolvedValue(null);
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Call the customer", assigneeId: "ghost" });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ASSIGNEE_NOT_FOUND");
    });

    it("forbids an AGENT from assigning to another user", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(agentToken))
        .send({ title: "Delegate", assigneeId: "agent-2" });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("lets an active AGENT self-assign", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "agent-1" });
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(agentToken))
        .send({ title: "My own task", assigneeId: "agent-1" });
      expect(response.status).toBe(201);
    });

    it("rejects a deactivated AGENT", async () => {
      mocks.userFindFirst.mockResolvedValue(null);
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(agentToken))
        .send({ title: "My own task" });
      expect(response.status).toBe(403);
    });

    it("rejects linkage to a ticket the actor cannot see", async () => {
      mocks.ticketFindFirst.mockResolvedValue(null);
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Investigate", ticketId: "ticket-1" });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    });

    it("rejects linkage when the assignee cannot see the ticket", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "agent-7" });
      mocks.ticketFindFirst
        .mockResolvedValueOnce({ id: "ticket-1" }) // actor can see it
        .mockResolvedValueOnce(null); // assignee cannot
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Investigate", assigneeId: "agent-7", ticketId: "ticket-1" });
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE");
    });

    it("rejects a too-short title", async () => {
      const response = await request(app).post("/api/tasks").set(auth(adminToken)).send({ title: "x" });
      expect(response.status).toBe(400);
    });

    it("rejects an unknown body field", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Valid title", bogus: true });
      expect(response.status).toBe(400);
    });
  });

  describe("update", () => {
    it("returns 404 when the task is not visible", async () => {
      mocks.taskFindFirst.mockResolvedValue(null);
      const response = await request(app)
        .patch("/api/tasks/task-x")
        .set(auth(agentToken))
        .send({ status: "DONE" });
      expect(response.status).toBe(404);
    });

    it("lets an assignee-only AGENT change status but nothing else", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "task-1",
        creatorId: "manager-1",
        assigneeId: "agent-1",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      const ok = await request(app).patch("/api/tasks/task-1").set(auth(agentToken)).send({ status: "DONE" });
      expect(ok.status).toBe(200);

      const denied = await request(app)
        .patch("/api/tasks/task-1")
        .set(auth(agentToken))
        .send({ title: "Renamed" });
      expect(denied.status).toBe(403);
    });

    it("forbids an AGENT creator from reassigning", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "task-1",
        creatorId: "agent-1",
        assigneeId: "agent-1",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      const response = await request(app)
        .patch("/api/tasks/task-1")
        .set(auth(agentToken))
        .send({ assigneeId: "agent-2" });
      expect(response.status).toBe(403);
    });

    it("notifies the new assignee and resets remindedAt on reassignment", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "task-1",
        creatorId: "admin-1",
        assigneeId: "agent-1",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      mocks.userFindFirst.mockResolvedValue({ id: "agent-2" });
      mocks.taskUpdate.mockResolvedValue(taskRow({ assigneeId: "agent-2" }));
      const response = await request(app)
        .patch("/api/tasks/task-1")
        .set(auth(adminToken))
        .send({ assigneeId: "agent-2" });
      expect(response.status).toBe(200);
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ assigneeId: "agent-2", remindedAt: null });
      expect(mocks.notificationCreateMany.mock.calls[0][0].data[0]).toMatchObject({
        userId: "agent-2",
        type: "TASK_ASSIGNED",
        taskId: "task-1",
      });
    });

    it("resets remindedAt when a DONE task is reopened", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "task-1",
        creatorId: "admin-1",
        assigneeId: "admin-1",
        ticketId: null,
        status: "DONE",
        dueAt: null,
      });
      await request(app).patch("/api/tasks/task-1").set(auth(adminToken)).send({ status: "OPEN" });
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ status: "OPEN", remindedAt: null });
    });

    it("resets remindedAt when the due date changes", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "task-1",
        creatorId: "admin-1",
        assigneeId: "admin-1",
        ticketId: null,
        status: "OPEN",
        dueAt: new Date("2026-08-20T00:00:00.000Z"),
      });
      await request(app)
        .patch("/api/tasks/task-1")
        .set(auth(adminToken))
        .send({ dueAt: "2026-09-01T00:00:00.000Z" });
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ remindedAt: null });
    });

    it("rejects an empty body", async () => {
      const response = await request(app).patch("/api/tasks/task-1").set(auth(adminToken)).send({});
      expect(response.status).toBe(400);
    });
  });

  describe("delete", () => {
    it("returns 404 when the task is not visible", async () => {
      mocks.taskFindFirst.mockResolvedValue(null);
      const response = await request(app).delete("/api/tasks/task-x").set(auth(agentToken));
      expect(response.status).toBe(404);
    });

    it("forbids an AGENT who is only the assignee", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "task-1", creatorId: "manager-1" });
      const response = await request(app).delete("/api/tasks/task-1").set(auth(agentToken));
      expect(response.status).toBe(403);
    });

    it("lets an AGENT creator delete", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "task-1", creatorId: "agent-1" });
      const response = await request(app).delete("/api/tasks/task-1").set(auth(agentToken));
      expect(response.status).toBe(204);
      expect(mocks.taskDelete).toHaveBeenCalledWith({ where: { id: "task-1" } });
    });

    it("lets an ADMIN delete any task", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "task-1", creatorId: "manager-1" });
      const response = await request(app).delete("/api/tasks/task-1").set(auth(adminToken));
      expect(response.status).toBe(204);
    });
  });
});
