import { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateCustomerInput, CustomerListQuery, UpdateCustomerInput } from "./customer.schema.js";

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
      attachments: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, mimeType: true, storageKey: true, createdAt: true } },
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

export async function createCustomer(input: CreateCustomerInput) {
  const existing = await prisma.customer.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw duplicateEmailError();

  try {
    return await prisma.customer.create({
      data: { ...input, userId: null },
      select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true },
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) throw duplicateEmailError();
    throw error;
  }
}

export async function updateCustomer(customerId: string, input: UpdateCustomerInput) {
  try {
    return await prisma.customer.update({
      where: { id: customerId }, data: input,
      select: { id: true, name: true, email: true, phone: true, createdAt: true, updatedAt: true },
    });
  } catch (error) {
    if (isPrismaError(error, "P2025")) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    if (isPrismaError(error, "P2002")) throw duplicateEmailError();
    throw error;
  }
}

export async function deleteCustomer(customerId: string) {
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
    await prisma.customer.delete({ where: { id: customerId } });
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

export async function addCustomerNote(customerId: string, authorUserId: string, body: string) {
  await ensureCustomerExists(customerId);
  return prisma.customerNote.create({
    data: { customerId, authorUserId, body },
    select: { id: true, body: true, createdAt: true, author: { select: { id: true, name: true, role: true } } },
  });
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
