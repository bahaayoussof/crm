import { Prisma, Role, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateCustomerInput, CustomerListQuery, CustomerTicketListQuery, UpdateCustomerInput } from "./customer.schema.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";

const closedStatuses = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

const customerListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
  tickets: { orderBy: { updatedAt: "desc" as const }, take: 1, select: { updatedAt: true } },
  _count: {
    select: {
      tickets: true,
    },
  },
} satisfies Prisma.CustomerSelect;

export async function listCustomers(query: CustomerListQuery) {
  const where: Prisma.CustomerWhereInput = query.search ? {
    OR: [
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
    ],
  } : {};
  const skip = (query.page - 1) * query.limit;

  const [records, total] = await prisma.$transaction([
    prisma.customer.findMany({ where, skip, take: query.limit, orderBy: { createdAt: "desc" }, select: customerListSelect }),
    prisma.customer.count({ where }),
  ]);

  const ids = records.map((customer) => customer.id);
  const openCounts = ids.length === 0 ? [] : await prisma.ticket.groupBy({
    by: ["customerId"],
    where: { customerId: { in: ids }, status: { notIn: closedStatuses } },
    _count: { _all: true },
  });
  const openCountByCustomer = new Map(openCounts.map((entry) => [entry.customerId, entry._count._all]));

  return {
    data: records.map(({ tickets, _count, ...customer }) => ({
      ...customer,
      openTicketCount: openCountByCustomer.get(customer.id) ?? 0,
      totalTicketCount: _count.tickets,
      lastInteractionAt: tickets[0]?.updatedAt ?? customer.updatedAt,
    })),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getCustomer(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, createdAt: true } },
      tickets: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
      _count: { select: { tickets: true } },
    },
  });

  if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

  const openTicketCount = await prisma.ticket.count({
    where: { customerId, status: { notIn: closedStatuses } },
  });
  const { tickets, _count, ...profile } = customer;
  return {
    ...profile,
    supportSummary: {
      openTicketCount,
      totalTicketCount: _count.tickets,
      lastInteractionAt: tickets[0]?.updatedAt ?? customer.updatedAt,
    },
  };
}

export async function listCustomerTickets(customerId: string, query: CustomerTicketListQuery, actor: { userId: string; role: Role }) {
  await ensureCustomerExists(customerId);
  const where: Prisma.TicketWhereInput = { customerId };
  const skip = (query.page - 1) * query.limit;
  const select = {
    id: true, subject: true, status: true, priority: true, createdAt: true, updatedAt: true, assignedAgentId: true,
    category: { select: { id: true, name: true } },
    assignedAgent: { select: { id: true, name: true } },
  } satisfies Prisma.TicketSelect;
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip, take: query.limit, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select }),
    prisma.ticket.count({ where }),
  ]);
  return {
    data: tickets.map(({ assignedAgentId, ...ticket }) => ({
      ...ticket,
      access: actor.role !== Role.AGENT || assignedAgentId === null || assignedAgentId === actor.userId ? "FULL" as const : "SUMMARY_ONLY" as const,
    })),
    meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) },
  };
}

export async function createCustomer(input: CreateCustomerInput, actorId: string, requestContext?: AuditRequestContext) {
  const existing = await prisma.customer.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw duplicateEmailError();

  try {
    return await prisma.$transaction(async (tx) => { const customer = await tx.customer.create({ data: { ...input, userId: null }, select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true } }); await createAuditLog({ actorId, action: AUDIT_ACTIONS.CUSTOMER_CREATED, entityType: AUDIT_ENTITY_TYPES.CUSTOMER, entityId: customer.id, changes: { name: { to: customer.name }, email: { to: customer.email }, phone: { to: customer.phone } }, requestContext }, tx); return customer; });
  } catch (error) {
    if (isPrismaError(error, "P2002")) throw duplicateEmailError();
    throw error;
  }
}

export async function updateCustomer(customerId: string, input: UpdateCustomerInput, actorId: string, requestContext?: AuditRequestContext) {
  try {
    return await prisma.$transaction(async (tx) => { const before = await tx.customer.findUnique({ where: { id: customerId }, select: { name: true, email: true, phone: true } }); if (!before) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found"); const customer = await tx.customer.update({ where: { id: customerId }, data: input, select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true } }); const changes = changedFields(before, customer, ["name", "email", "phone"]); if (Object.keys(changes).length) await createAuditLog({ actorId, action: AUDIT_ACTIONS.CUSTOMER_UPDATED, entityType: AUDIT_ENTITY_TYPES.CUSTOMER, entityId: customerId, changes, requestContext }, tx); return customer; });
  } catch (error) {
    if (isPrismaError(error, "P2025")) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    if (isPrismaError(error, "P2002")) throw duplicateEmailError();
    throw error;
  }
}

export async function deleteCustomer(customerId: string, actorId: string, requestContext?: AuditRequestContext) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { userId: true, _count: { select: { tickets: true, feedback: true, notes: true, attachments: true } } },
  });
  if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

  const hasHistory = customer.userId !== null || Object.values(customer._count).some((count) => count > 0);
  if (hasHistory) {
    throw new AppError(409, "CUSTOMER_HAS_SUPPORT_HISTORY", "Customer cannot be deleted because support history or a login identity exists");
  }

  try {
    await prisma.$transaction(async (tx) => { await tx.customer.delete({ where: { id: customerId } }); await createAuditLog({ actorId, action: AUDIT_ACTIONS.CUSTOMER_DELETED, entityType: AUDIT_ENTITY_TYPES.CUSTOMER, entityId: customerId, requestContext }, tx); });
  } catch (error) {
    if (isPrismaError(error, "P2003")) {
      throw new AppError(409, "CUSTOMER_HAS_SUPPORT_HISTORY", "Customer cannot be deleted because support history or a login identity exists");
    }
    if (isPrismaError(error, "P2025")) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    throw error;
  }
}

export async function listCustomerNotes(customerId: string) {
  await ensureCustomerExists(customerId);
  return prisma.customerNote.findMany({
    where: { customerId }, orderBy: { createdAt: "desc" },
    select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
}

export async function addCustomerNote(customerId: string, authorUserId: string, body: string, requestContext?: AuditRequestContext) {
  await ensureCustomerExists(customerId);
  return prisma.$transaction(async (tx) => { const note = await tx.customerNote.create({ data: { customerId, authorUserId, body }, select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } } }); await createAuditLog({ actorId: authorUserId, action: AUDIT_ACTIONS.CUSTOMER_NOTE_ADDED, entityType: AUDIT_ENTITY_TYPES.CUSTOMER, entityId: customerId, metadata: { noteId: note.id }, requestContext }, tx); return note; });
}

async function ensureCustomerExists(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
}

function duplicateEmailError() {
  return new AppError(409, "CUSTOMER_EMAIL_EXISTS", "A customer with this email already exists");
}

function isPrismaError(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
