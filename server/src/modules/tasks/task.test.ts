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
const adminToken = token("c90b1b286043f1b7612e423c7", Role.ADMIN);
const managerToken = token("c6fd0a01a46ed4545f0a5e774", Role.MANAGER);
const agentToken = token("c6ff3b3bd11c44cac620c43d5", Role.AGENT);
const customerToken = token("ce83f10dcd2c68747c3f3ba14", Role.CUSTOMER);
const auth = (value: string) => ({ Authorization: `Bearer ${value}` });
const now = new Date("2026-08-28T12:00:00.000Z");

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: "c7afaa346b4bf92bf9dc21e9a",
  title: "Follow up with customer",
  description: null,
  status: "OPEN",
  dueAt: null,
  remindedAt: null,
  ticketId: null,
  creatorId: "c90b1b286043f1b7612e423c7",
  assigneeId: "c90b1b286043f1b7612e423c7",
  createdAt: now,
  updatedAt: now,
  creator: { id: "c90b1b286043f1b7612e423c7", name: "Admin User" },
  assignee: { id: "c90b1b286043f1b7612e423c7", name: "Admin User" },
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
      expect((await request(app).get("/api/tasks/c7afaa346b4bf92bf9dc21e9a")).status).toBe(401);
      expect((await request(app).post("/api/tasks").send({ title: "A task" })).status).toBe(401);
      expect((await request(app).patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a").send({ status: "DONE" })).status).toBe(401);
      expect((await request(app).delete("/api/tasks/c7afaa346b4bf92bf9dc21e9a")).status).toBe(401);
    });

    it("rejects CUSTOMER from every route", async () => {
      expect((await request(app).get("/api/tasks").set(auth(customerToken))).status).toBe(403);
      expect((await request(app).get("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(customerToken))).status).toBe(403);
      expect(
        (await request(app).post("/api/tasks").set(auth(customerToken)).send({ title: "A task" })).status,
      ).toBe(403);
      expect(
        (await request(app).patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(customerToken)).send({ status: "DONE" })).status,
      ).toBe(403);
      expect((await request(app).delete("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(customerToken))).status).toBe(403);
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
      expect(where.OR).toEqual([{ creatorId: "c6ff3b3bd11c44cac620c43d5" }, { assigneeId: "c6ff3b3bd11c44cac620c43d5" }]);
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
      await request(app).get("/api/tasks?assigneeId=ceb21e2197bd1001410dd4dd4").set(auth(agentToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.assigneeId).toBeUndefined();
    });

    it("honours an assigneeId filter from a MANAGER", async () => {
      await request(app).get("/api/tasks?assigneeId=c52904c0e5ca009722ff46b3e").set(auth(managerToken));
      const where = mocks.taskFindMany.mock.calls[0][0].where;
      expect(where.assigneeId).toBe("c52904c0e5ca009722ff46b3e");
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
      const response = await request(app).get("/api/tasks/cbfa2ad801fa6a628b7991fe0").set(auth(agentToken));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TASK_NOT_FOUND");
    });

    it("returns the task with a safe assignee projection", async () => {
      mocks.taskFindFirst.mockResolvedValue(taskRow());
      const response = await request(app).get("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(adminToken));
      expect(response.status).toBe(200);
      expect(response.body.data.assignee).toEqual({ id: "c90b1b286043f1b7612e423c7", name: "Admin User" });
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
        creatorId: "c90b1b286043f1b7612e423c7",
        assigneeId: "c90b1b286043f1b7612e423c7",
      });
      expect(mocks.notificationCreateMany).not.toHaveBeenCalled();
    });

    it("notifies the assignee when ADMIN assigns to an active agent", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "ccfad431af89dd48c0fe73ace" });
      mocks.taskCreate.mockResolvedValue(taskRow({ id: "task-9", assigneeId: "ccfad431af89dd48c0fe73ace" }));
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Call the customer", assigneeId: "ccfad431af89dd48c0fe73ace" });
      expect(response.status).toBe(201);
      const payload = mocks.notificationCreateMany.mock.calls[0][0].data[0];
      expect(payload).toMatchObject({ userId: "ccfad431af89dd48c0fe73ace", type: "TASK_ASSIGNED", taskId: "task-9", ticketId: null });
    });

    it("rejects an assignee that is not an active agent", async () => {
      mocks.userFindFirst.mockResolvedValue(null);
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Call the customer", assigneeId: "cead6ef03d61ee60c533d6d45" });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("ASSIGNEE_NOT_FOUND");
    });

    it("forbids an AGENT from assigning to another user", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(agentToken))
        .send({ title: "Delegate", assigneeId: "cc3544aa158a89417843d45b3" });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    });

    it("lets an active AGENT self-assign", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "c6ff3b3bd11c44cac620c43d5" });
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(agentToken))
        .send({ title: "My own task", assigneeId: "c6ff3b3bd11c44cac620c43d5" });
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
        .send({ title: "Investigate", ticketId: "c737ce60fccf9da889f4605c0" });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("TICKET_NOT_FOUND");
    });

    it("rejects linkage when the assignee cannot see the ticket", async () => {
      mocks.userFindFirst.mockResolvedValue({ id: "ccfad431af89dd48c0fe73ace" });
      mocks.ticketFindFirst
        .mockResolvedValueOnce({ id: "c737ce60fccf9da889f4605c0" }) // actor can see it
        .mockResolvedValueOnce(null); // assignee cannot
      const response = await request(app)
        .post("/api/tasks")
        .set(auth(adminToken))
        .send({ title: "Investigate", assigneeId: "ccfad431af89dd48c0fe73ace", ticketId: "c737ce60fccf9da889f4605c0" });
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
        .patch("/api/tasks/cbfa2ad801fa6a628b7991fe0")
        .set(auth(agentToken))
        .send({ status: "DONE" });
      expect(response.status).toBe(404);
    });

    it("lets an assignee-only AGENT change status but nothing else", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "c7afaa346b4bf92bf9dc21e9a",
        creatorId: "c6fd0a01a46ed4545f0a5e774",
        assigneeId: "c6ff3b3bd11c44cac620c43d5",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      const ok = await request(app).patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(agentToken)).send({ status: "DONE" });
      expect(ok.status).toBe(200);

      const denied = await request(app)
        .patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a")
        .set(auth(agentToken))
        .send({ title: "Renamed" });
      expect(denied.status).toBe(403);
    });

    it("forbids an AGENT creator from reassigning", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "c7afaa346b4bf92bf9dc21e9a",
        creatorId: "c6ff3b3bd11c44cac620c43d5",
        assigneeId: "c6ff3b3bd11c44cac620c43d5",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      const response = await request(app)
        .patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a")
        .set(auth(agentToken))
        .send({ assigneeId: "cc3544aa158a89417843d45b3" });
      expect(response.status).toBe(403);
    });

    it("notifies the new assignee and resets remindedAt on reassignment", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "c7afaa346b4bf92bf9dc21e9a",
        creatorId: "c90b1b286043f1b7612e423c7",
        assigneeId: "c6ff3b3bd11c44cac620c43d5",
        ticketId: null,
        status: "OPEN",
        dueAt: null,
      });
      mocks.userFindFirst.mockResolvedValue({ id: "cc3544aa158a89417843d45b3" });
      mocks.taskUpdate.mockResolvedValue(taskRow({ assigneeId: "cc3544aa158a89417843d45b3" }));
      const response = await request(app)
        .patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a")
        .set(auth(adminToken))
        .send({ assigneeId: "cc3544aa158a89417843d45b3" });
      expect(response.status).toBe(200);
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ assigneeId: "cc3544aa158a89417843d45b3", remindedAt: null });
      expect(mocks.notificationCreateMany.mock.calls[0][0].data[0]).toMatchObject({
        userId: "cc3544aa158a89417843d45b3",
        type: "TASK_ASSIGNED",
        taskId: "c7afaa346b4bf92bf9dc21e9a",
      });
    });

    it("resets remindedAt when a DONE task is reopened", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "c7afaa346b4bf92bf9dc21e9a",
        creatorId: "c90b1b286043f1b7612e423c7",
        assigneeId: "c90b1b286043f1b7612e423c7",
        ticketId: null,
        status: "DONE",
        dueAt: null,
      });
      await request(app).patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(adminToken)).send({ status: "OPEN" });
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ status: "OPEN", remindedAt: null });
    });

    it("resets remindedAt when the due date changes", async () => {
      mocks.taskFindFirst.mockResolvedValue({
        id: "c7afaa346b4bf92bf9dc21e9a",
        creatorId: "c90b1b286043f1b7612e423c7",
        assigneeId: "c90b1b286043f1b7612e423c7",
        ticketId: null,
        status: "OPEN",
        dueAt: new Date("2026-08-20T00:00:00.000Z"),
      });
      await request(app)
        .patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a")
        .set(auth(adminToken))
        .send({ dueAt: "2026-09-01T00:00:00.000Z" });
      expect(mocks.taskUpdate.mock.calls[0][0].data).toMatchObject({ remindedAt: null });
    });

    it("rejects an empty body", async () => {
      const response = await request(app).patch("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(adminToken)).send({});
      expect(response.status).toBe(400);
    });
  });

  describe("delete", () => {
    it("returns 404 when the task is not visible", async () => {
      mocks.taskFindFirst.mockResolvedValue(null);
      const response = await request(app).delete("/api/tasks/cbfa2ad801fa6a628b7991fe0").set(auth(agentToken));
      expect(response.status).toBe(404);
    });

    it("forbids an AGENT who is only the assignee", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "c7afaa346b4bf92bf9dc21e9a", creatorId: "c6fd0a01a46ed4545f0a5e774" });
      const response = await request(app).delete("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(agentToken));
      expect(response.status).toBe(403);
    });

    it("lets an AGENT creator delete", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "c7afaa346b4bf92bf9dc21e9a", creatorId: "c6ff3b3bd11c44cac620c43d5" });
      const response = await request(app).delete("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(agentToken));
      expect(response.status).toBe(204);
      expect(mocks.taskDelete).toHaveBeenCalledWith({ where: { id: "c7afaa346b4bf92bf9dc21e9a" } });
    });

    it("lets an ADMIN delete any task", async () => {
      mocks.taskFindFirst.mockResolvedValue({ id: "c7afaa346b4bf92bf9dc21e9a", creatorId: "c6fd0a01a46ed4545f0a5e774" });
      const response = await request(app).delete("/api/tasks/c7afaa346b4bf92bf9dc21e9a").set(auth(adminToken));
      expect(response.status).toBe(204);
    });
  });
});
