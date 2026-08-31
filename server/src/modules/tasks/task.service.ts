import { Prisma, Role, TaskStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createNotifications } from "../notifications/notification.service.js";
import { withRealtimeOutbox } from "../realtime/realtime.publisher.js";
import { ticketVisibilityWhere } from "../tickets/ticket-visibility.js";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./task.schema.js";

// ---------------------------------------------------------------------------
// Actor type
// ---------------------------------------------------------------------------
export interface TaskActor {
  userId: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Safe projections
// ---------------------------------------------------------------------------

/** Safe projection for the assignee user — never leak passwords. */
const userProjection = { id: true, name: true } satisfies Prisma.UserSelect;

/** Safe Ticket projection — only after visibility is established. */
const ticketProjection = { id: true, subject: true } satisfies Prisma.TicketSelect;

export const taskSummarySelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueAt: true,
  remindedAt: true,
  ticketId: true,
  creatorId: true,
  assigneeId: true,
  createdAt: true,
  updatedAt: true,
  creator: { select: userProjection },
  assignee: { select: userProjection },
  ticket: { select: ticketProjection },
} satisfies Prisma.TaskSelect;

// ---------------------------------------------------------------------------
// Visibility predicate
// ---------------------------------------------------------------------------
function taskVisibilityWhere(actor: TaskActor): Prisma.TaskWhereInput {
  if (actor.role === Role.ADMIN || actor.role === Role.MANAGER) return {};
  // AGENT: tasks they created OR tasks assigned to them
  return { OR: [{ creatorId: actor.userId }, { assigneeId: actor.userId }] };
}

// ---------------------------------------------------------------------------
// Ticket accessibility check (reuses existing ticket visibility policy)
// ---------------------------------------------------------------------------
async function assertTicketAccessible(ticketId: string, actor: TaskActor): Promise<void> {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor) },
    select: { id: true },
  });
  if (!ticket) {
    throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  }
}

// ---------------------------------------------------------------------------
// Assignee validation: active AGENT only for non-ADMIN/MANAGER actors,
// or active AGENT OR self (the actor) for ADMIN/MANAGER.
// An AGENT may only assign to themselves.
// ---------------------------------------------------------------------------
async function resolveAssigneeId(
  requestedAssigneeId: string | undefined,
  actor: TaskActor,
): Promise<string> {
  // AGENT: may only self-assign
  if (actor.role === Role.AGENT) {
    if (requestedAssigneeId !== undefined && requestedAssigneeId !== actor.userId) {
      throw new AppError(403, "FORBIDDEN", "Agents may only assign tasks to themselves");
    }
    // Verify the actor themselves is still active
    const self = await prisma.user.findFirst({
      where: { id: actor.userId, isActive: true, role: Role.AGENT },
      select: { id: true },
    });
    if (!self) throw new AppError(403, "FORBIDDEN", "Your account is not active");
    return actor.userId;
  }

  // ADMIN/MANAGER: self-assign or assign to an active AGENT
  if (requestedAssigneeId === undefined || requestedAssigneeId === actor.userId) {
    return actor.userId;
  }

  const assignee = await prisma.user.findFirst({
    where: { id: requestedAssigneeId, isActive: true, role: Role.AGENT },
    select: { id: true },
  });
  if (!assignee) {
    throw new AppError(404, "ASSIGNEE_NOT_FOUND", "Assignee not found or is not an active agent");
  }
  return requestedAssigneeId;
}

// ---------------------------------------------------------------------------
// List tasks
// ---------------------------------------------------------------------------
export async function listTasks(actor: TaskActor, query: ListTasksQuery) {
  const visibilityWhere = taskVisibilityWhere(actor);
  const searchWhere: Prisma.TaskWhereInput = query.search
    ? {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.TaskWhereInput = {
    ...visibilityWhere,
    ...searchWhere,
    ...(query.status ? { status: query.status as TaskStatus } : {}),
    // AGENT cannot filter by another user's assigneeId; ignore filter silently
    ...(query.assigneeId && (actor.role === Role.ADMIN || actor.role === Role.MANAGER)
      ? { assigneeId: query.assigneeId }
      : {}),
    ...(query.ticketId ? { ticketId: query.ticketId } : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [records, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      skip,
      take: query.limit,
      // dueAt ASC nulls last, then createdAt DESC, then id ASC for determinism
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }, { id: "asc" }],
      select: taskSummarySelect,
    }),
    prisma.task.count({ where }),
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

// ---------------------------------------------------------------------------
// Get single task
// ---------------------------------------------------------------------------
export async function getTask(actor: TaskActor, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, ...taskVisibilityWhere(actor) },
    select: taskSummarySelect,
  });
  if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  return task;
}

// ---------------------------------------------------------------------------
// Create task
// ---------------------------------------------------------------------------
export async function createTask(actor: TaskActor, input: CreateTaskInput) {
  // Resolve and validate assignee
  const assigneeId = await resolveAssigneeId(input.assigneeId, actor);

  // Validate ticket linkage if provided
  if (input.ticketId) {
    await assertTicketAccessible(input.ticketId, actor);
    // When assigning to another AGENT, also validate AGENT can access the ticket
    if (assigneeId !== actor.userId) {
      const assigneeActor: TaskActor = { userId: assigneeId, role: Role.AGENT };
      const ticketAccessible = await prisma.ticket.findFirst({
        where: { id: input.ticketId, ...ticketVisibilityWhere(assigneeActor) },
        select: { id: true },
      });
      if (!ticketAccessible) {
        throw new AppError(
          422,
          "TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE",
          "The assigned agent does not have access to the linked ticket",
        );
      }
    }
  }

  const isAssigningToOther = assigneeId !== actor.userId;

  const task = await withRealtimeOutbox(() => prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        ticketId: input.ticketId ?? null,
        creatorId: actor.userId,
        assigneeId,
      },
      select: taskSummarySelect,
    });

    // Notify the assignee only when assigning to another user
    if (isAssigningToOther) {
      await createNotifications(
        tx,
        [assigneeId],
        "TASK_ASSIGNED",
        "New task assigned to you",
        `You have been assigned a new task: ${created.title}`,
        null,
        created.id,
      );
    }

    return created;
  }));

  return task;
}

// ---------------------------------------------------------------------------
// Update task — field-level permission enforcement
//
// Permission matrix (enforced server-side):
//   ADMIN/MANAGER            → all fields
//   AGENT creator/self-task  → status, content, dueAt, ticketId | NOT assigneeId
//   AGENT assignee (not creator) → status ONLY
//   Unrelated AGENT          → 403
// ---------------------------------------------------------------------------
export async function updateTask(actor: TaskActor, taskId: string, input: UpdateTaskInput) {
  // Fetch task with visibility gate first
  const existing = await prisma.task.findFirst({
    where: { id: taskId, ...taskVisibilityWhere(actor) },
    select: { id: true, creatorId: true, assigneeId: true, ticketId: true, status: true, dueAt: true },
  });
  if (!existing) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");

  const isAdminOrManager = actor.role === Role.ADMIN || actor.role === Role.MANAGER;
  const isCreator = existing.creatorId === actor.userId;
  const isAssignee = existing.assigneeId === actor.userId;

  // Determine what fields this actor can change
  if (!isAdminOrManager && !isCreator && !isAssignee) {
    // Should be caught by visibility, but guard anyway
    throw new AppError(403, "FORBIDDEN", "You do not have permission to update this task");
  }

  // AGENT who is assignee-only: may only change status
  if (!isAdminOrManager && !isCreator && isAssignee) {
    const forbiddenFields = (["title", "description", "dueAt", "assigneeId", "ticketId"] as const).filter(
      (field) => input[field] !== undefined,
    );
    if (forbiddenFields.length > 0) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Assignees may only change the task status",
      );
    }
  }

  // AGENT creator: cannot change assigneeId
  if (!isAdminOrManager && isCreator && input.assigneeId !== undefined) {
    throw new AppError(403, "FORBIDDEN", "Agents cannot reassign tasks");
  }

  // Validate new assigneeId if provided (ADMIN/MANAGER only at this point)
  let newAssigneeId: string | undefined;
  if (input.assigneeId !== undefined && isAdminOrManager) {
    newAssigneeId = await resolveAssigneeId(input.assigneeId, actor);
  }

  // Validate new ticketId if changing
  const isChangingTicket = input.ticketId !== undefined && input.ticketId !== existing.ticketId;
  const isChangingAssignee = newAssigneeId !== undefined && newAssigneeId !== existing.assigneeId;

  if (isChangingTicket && input.ticketId) {
    await assertTicketAccessible(input.ticketId, actor);
    // Validate assignee can also access the new ticket
    const effectiveAssigneeId = newAssigneeId ?? existing.assigneeId;
    const assigneeActor: TaskActor = { userId: effectiveAssigneeId, role: Role.AGENT };
    const ticketAccessible = await prisma.ticket.findFirst({
      where: { id: input.ticketId, ...ticketVisibilityWhere(assigneeActor) },
      select: { id: true },
    });
    if (!ticketAccessible) {
      throw new AppError(
        422,
        "TICKET_NOT_ACCESSIBLE_BY_ASSIGNEE",
        "The assignee does not have access to the linked ticket",
      );
    }
  }

  // Determine if remindedAt should be reset
  const isChangingDueAt =
    input.dueAt !== undefined &&
    (input.dueAt === null || new Date(input.dueAt).getTime() !== existing.dueAt?.getTime());
  const isReopening = input.status === "OPEN" && existing.status === TaskStatus.DONE;

  const shouldResetRemindedAt = isChangingDueAt || isChangingAssignee || isReopening;

  // Build update data
  const updateData: Prisma.TaskUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status as TaskStatus } : {}),
    ...(input.dueAt !== undefined
      ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
      : {}),
    ...(isChangingTicket ? { ticketId: input.ticketId ?? null } : {}),
    ...(newAssigneeId ? { assigneeId: newAssigneeId } : {}),
    ...(shouldResetRemindedAt ? { remindedAt: null } : {}),
  };

  const previousAssigneeId = existing.assigneeId;

  const updated = await withRealtimeOutbox(() => prisma.$transaction(async (tx) => {
    const result = await tx.task.update({
      where: { id: taskId },
      data: updateData,
      select: taskSummarySelect,
    });

    // Notify the new assignee if assignment changed (ADMIN/MANAGER only)
    if (isAdminOrManager && isChangingAssignee && newAssigneeId !== previousAssigneeId) {
      await createNotifications(
        tx,
        [newAssigneeId!],
        "TASK_ASSIGNED",
        "Task assigned to you",
        `You have been assigned a task: ${result.title}`,
        null,
        result.id,
      );
    }

    return result;
  }));

  return updated;
}

// ---------------------------------------------------------------------------
// Delete task
// ---------------------------------------------------------------------------
export async function deleteTask(actor: TaskActor, taskId: string) {
  // Visibility gate first
  const existing = await prisma.task.findFirst({
    where: { id: taskId, ...taskVisibilityWhere(actor) },
    select: { id: true, creatorId: true },
  });
  if (!existing) throw new AppError(404, "TASK_NOT_FOUND", "Task not found");

  const isAdminOrManager = actor.role === Role.ADMIN || actor.role === Role.MANAGER;
  const isCreator = existing.creatorId === actor.userId;

  if (!isAdminOrManager && !isCreator) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to delete this task");
  }

  await prisma.task.delete({ where: { id: taskId } });
}
