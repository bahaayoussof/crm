import { Prisma, Role, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateTicketInput, TicketConversationInput, TicketListQuery, UpdateTicketInput } from "./ticket.schema.js";
import { ticketVisibilityWhere, type TicketActor as Actor } from "./ticket-visibility.js";

const ticketSummarySelect = {
  id: true, subject: true, status: true, priority: true, channel: true,
  firstResponseDueAt: true, firstRespondedAt: true, resolutionDueAt: true,
  createdAt: true, updatedAt: true,
  customer: { select: { id: true, name: true, email: true } },
  assignedAgent: { select: { id: true, name: true, email: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

const transitions: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.ESCALATED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED],
  IN_PROGRESS: [TicketStatus.WAITING_CUSTOMER, TicketStatus.RESOLVED, TicketStatus.ESCALATED],
  WAITING_CUSTOMER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.ESCALATED],
  RESOLVED: [TicketStatus.CLOSED],
  CLOSED: [],
  ESCALATED: [TicketStatus.IN_PROGRESS],
};

export async function listTickets(query: TicketListQuery, actor: Actor) {
  const where: Prisma.TicketWhereInput = {
    ...ticketVisibilityWhere(actor),
    ...(query.status && { status: query.status }),
    ...(query.priority && { priority: query.priority }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.assignedAgentId && { assignedAgentId: query.assignedAgentId }),
    ...(query.customerId && { customerId: query.customerId }),
    ...(query.search && { AND: [{ OR: [
      { id: query.search },
      { subject: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { customer: { name: { contains: query.search, mode: "insensitive" } } },
      { customer: { email: { contains: query.search, mode: "insensitive" } } },
    ] }] }),
  };
  const skip = (query.page - 1) * query.limit;
  const [records, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip, take: query.limit, orderBy: { updatedAt: "desc" }, select: ticketSummarySelect }),
    prisma.ticket.count({ where }),
  ]);
  return { data: records, meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
}

export async function getTicket(ticketId: string, actor: Actor) {
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ...ticketVisibilityWhere(actor) },
    select: {
      ...ticketSummarySelect, description: true, resolvedAt: true, closedAt: true,
      department: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
      history: { orderBy: { createdAt: "desc" }, select: {
        id: true, action: true, oldValue: true, newValue: true, createdAt: true,
        actor: { select: { id: true, name: true, role: true } },
      } },
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: conversationSelect },
      notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: conversationSelect },
    },
  });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  const { messages, notes, ...detail } = ticket;
  return {
    ...detail,
    conversation: [
      ...messages.map((item) => ({ ...item, kind: "PUBLIC_MESSAGE" as const })),
      ...notes.map((item) => ({ ...item, kind: "INTERNAL_NOTE" as const })),
    ].sort(compareConversation),
  };
}

export async function addTicketMessage(ticketId: string, input: TicketConversationInput, actor: Actor) {
  const createdAt = new Date();
  return prisma.$transaction(async (tx) => {
    await requireConversationMutationAccess(tx, ticketId, actor);
    const message = await tx.ticketMessage.create({
      data: { ticketId, authorUserId: actor.userId, body: input.body, createdAt },
      select: conversationSelect,
    });
    await tx.ticket.updateMany({ where: { id: ticketId, firstRespondedAt: null }, data: { firstRespondedAt: createdAt } });
    return { ...message, kind: "PUBLIC_MESSAGE" as const };
  });
}

export async function addTicketNote(ticketId: string, input: TicketConversationInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    await requireConversationMutationAccess(tx, ticketId, actor);
    const note = await tx.ticketNote.create({
      data: { ticketId, authorUserId: actor.userId, body: input.body },
      select: conversationSelect,
    });
    return { ...note, kind: "INTERNAL_NOTE" as const };
  });
}

export async function createTicket(input: CreateTicketInput, actor: Actor) {
  if (actor.role === Role.AGENT && input.assignedAgentId) throw forbidden("Agents cannot assign tickets");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const relations = await validateRelations(tx, input);
    const sla = await tx.slaRule.findFirst({ where: { priority: input.priority, isActive: true } });
    const ticket = await tx.ticket.create({
      data: {
        ...input, createdAt: now,
        firstResponseDueAt: sla ? addMinutes(now, sla.firstResponseMinutes) : null,
        resolutionDueAt: sla ? addMinutes(now, sla.resolutionMinutes) : null,
      },
      select: ticketSummarySelect,
    });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "TICKET_CREATED", newValue: TicketStatus.NEW } });
    if (input.assignedAgentId) await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "ASSIGNMENT_CHANGED", newValue: relations.agent?.name ?? input.assignedAgentId } });
    if (input.categoryId) await tx.ticketHistory.create({ data: { ticketId: ticket.id, actorUserId: actor.userId, action: "CATEGORY_CHANGED", newValue: relations.category?.name ?? input.categoryId } });
    return ticket;
  });
}

export async function updateTicket(ticketId: string, input: UpdateTicketInput, actor: Actor) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.ticket.findFirst({
      where: { id: ticketId, ...ticketVisibilityWhere(actor) },
      select: { id: true, subject: true, description: true, status: true, priority: true, categoryId: true, assignedAgentId: true, departmentId: true, branchId: true, firstRespondedAt: true, category: { select: { name: true } }, assignedAgent: { select: { name: true } } },
    });
    if (!current) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");

    enforceMutationPermissions(current, input, actor);
    const relations = await validateRelations(tx, input, { departmentId: input.departmentId ?? current.departmentId, branchId: input.branchId ?? current.branchId });
    if (input.status && input.status !== current.status) validateTransition(current.status, input.status, actor.role);

    const data: Prisma.TicketUpdateInput = {};
    if (input.subject !== undefined) data.subject = input.subject;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.status !== undefined) data.status = input.status;
    if (input.categoryId !== undefined) data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    if (input.assignedAgentId !== undefined) data.assignedAgent = input.assignedAgentId ? { connect: { id: input.assignedAgentId } } : { disconnect: true };
    if (input.departmentId !== undefined) data.department = input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true };
    if (input.branchId !== undefined) data.branch = input.branchId ? { connect: { id: input.branchId } } : { disconnect: true };
    if (input.status === TicketStatus.RESOLVED && current.status !== TicketStatus.RESOLVED) data.resolvedAt = now;
    if (input.status === TicketStatus.CLOSED && current.status !== TicketStatus.CLOSED) data.closedAt = now;

    if (input.priority && input.priority !== current.priority && current.status !== TicketStatus.RESOLVED && current.status !== TicketStatus.CLOSED) {
      const sla = await tx.slaRule.findFirst({ where: { priority: input.priority, isActive: true } });
      if (current.firstRespondedAt === null) data.firstResponseDueAt = sla ? addMinutes(now, sla.firstResponseMinutes) : null;
      data.resolutionDueAt = sla ? addMinutes(now, sla.resolutionMinutes) : null;
    }

    const updated = await tx.ticket.update({ where: { id: ticketId }, data, select: ticketSummarySelect });
    const events: Prisma.TicketHistoryCreateManyInput[] = [];
    if (input.status && input.status !== current.status) events.push(history(ticketId, actor.userId, "STATUS_CHANGED", current.status, input.status));
    if (input.priority && input.priority !== current.priority) events.push(history(ticketId, actor.userId, "PRIORITY_CHANGED", current.priority, input.priority));
    if (input.assignedAgentId !== undefined && input.assignedAgentId !== current.assignedAgentId) events.push(history(ticketId, actor.userId, "ASSIGNMENT_CHANGED", current.assignedAgent?.name ?? null, relations.agent?.name ?? null));
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) events.push(history(ticketId, actor.userId, "CATEGORY_CHANGED", current.category?.name ?? null, relations.category?.name ?? null));
    if (events.length) await tx.ticketHistory.createMany({ data: events });
    return updated;
  });
}

const conversationSelect = {
  id: true, body: true, createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TicketMessageSelect & Prisma.TicketNoteSelect;

async function requireConversationMutationAccess(tx: Prisma.TransactionClient, ticketId: string, actor: Actor) {
  const ticket = await tx.ticket.findFirst({ where: { id: ticketId, ...ticketVisibilityWhere(actor) }, select: { id: true, assignedAgentId: true } });
  if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found");
  if (actor.role === Role.AGENT && ticket.assignedAgentId !== actor.userId) throw forbidden("Ticket must be assigned to the agent before adding conversation content");
}

function compareConversation(left: { createdAt: Date; kind: string; id: string }, right: { createdAt: Date; kind: string; id: string }) {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id);
}

function enforceMutationPermissions(current: { assignedAgentId: string | null }, input: UpdateTicketInput, actor: Actor) {
  if (actor.role !== Role.AGENT) return;
  if (input.assignedAgentId !== undefined) throw forbidden("Agents cannot assign tickets");
  if ((input.priority !== undefined || input.status !== undefined) && current.assignedAgentId !== actor.userId) throw forbidden("Ticket must be assigned to the agent before workflow changes");
}

function validateTransition(from: TicketStatus, to: TicketStatus, role: Role) {
  if (!transitions[from].includes(to)) throw new AppError(409, "INVALID_STATUS_TRANSITION", `Cannot transition ticket from ${from} to ${to}`);
  if ((from === TicketStatus.ESCALATED || to === TicketStatus.ESCALATED) && role === Role.AGENT) throw forbidden("Agents cannot change escalation status");
}

async function validateRelations(tx: Prisma.TransactionClient, input: Partial<CreateTicketInput & UpdateTicketInput>, organization?: { departmentId?: string | null; branchId?: string | null }) {
  const customer = input.customerId ? await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } }) : null;
  if (input.customerId && !customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  const agent = input.assignedAgentId ? await tx.user.findFirst({ where: { id: input.assignedAgentId, role: Role.AGENT }, select: { id: true, name: true } }) : null;
  if (input.assignedAgentId && !agent) throw new AppError(400, "INVALID_ASSIGNED_AGENT", "Assigned user must be an agent");
  const category = input.categoryId ? await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true, name: true } }) : null;
  if (input.categoryId && !category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  const departmentId = organization?.departmentId ?? input.departmentId;
  const branchId = organization?.branchId ?? input.branchId;
  const department = departmentId ? await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, branchId: true } }) : null;
  if (departmentId && !department) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
  const branch = branchId ? await tx.branch.findUnique({ where: { id: branchId }, select: { id: true } }) : null;
  if (branchId && !branch) throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
  if (department && branchId && department.branchId !== branchId) throw new AppError(400, "DEPARTMENT_BRANCH_MISMATCH", "Department does not belong to the selected branch");
  return { agent, category };
}

function history(ticketId: string, actorUserId: string, action: string, oldValue: string | null, newValue: string | null): Prisma.TicketHistoryCreateManyInput {
  return { ticketId, actorUserId, action, oldValue, newValue };
}
function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
function forbidden(message: string) { return new AppError(403, "FORBIDDEN", message); }

export const ticketWorkflow = { transitions };
