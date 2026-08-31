import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import type { BranchListQuery, CreateBranchInput, UpdateBranchInput } from "./branch.schema.js";

const branchSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  isActive: true,
  _count: { select: { departments: true, users: true, tickets: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

type BranchRow = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;

function shape(row: BranchRow) {
  const { _count, ...rest } = row;
  return {
    ...rest,
    departmentCount: _count.departments,
    userCount: _count.users,
    ticketCount: _count.tickets,
  };
}

function notFound() {
  return new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
}
function nameConflict() {
  return new AppError(409, "BRANCH_NAME_ALREADY_EXISTS", "A branch with this name already exists");
}
function codeConflict() {
  return new AppError(409, "BRANCH_CODE_ALREADY_EXISTS", "A branch with this code already exists");
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = (error.meta?.target as string[] | string | undefined) ?? "";
    throw String(target).includes("code") ? codeConflict() : nameConflict();
  }
  throw error;
}

async function assertNameAvailable(name: string, excludeId?: string) {
  const clash = await prisma.branch.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw nameConflict();
}
async function assertCodeAvailable(code: string, excludeId?: string) {
  const clash = await prisma.branch.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) throw codeConflict();
}

export async function listBranches(query: BranchListQuery) {
  const where: Prisma.BranchWhereInput = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { code: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
  };
  const [records, total] = await prisma.$transaction([
    prisma.branch.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: branchSelect,
    }),
    prisma.branch.count({ where }),
  ]);
  return {
    data: records.map(shape),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

/** Active-only lookup for assignment selectors, ticket filters and reports. */
export async function listActiveBranches() {
  return prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
}

export async function createBranch(
  input: CreateBranchInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const code = input.code ?? null;
  await assertNameAvailable(input.name);
  if (code) await assertCodeAvailable(code);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.branch.create({
        data: { name: input.name, code, address: input.address || null },
        select: branchSelect,
      });
      await createAuditLog(
        {
          actorId,
          action: AUDIT_ACTIONS.BRANCH_CREATED,
          entityType: AUDIT_ENTITY_TYPES.BRANCH,
          entityId: row.id,
          changes: {
            name: { to: row.name },
            code: { to: row.code },
            address: { to: row.address },
            isActive: { to: row.isActive },
          },
          requestContext,
        },
        tx,
      );
      return shape(row);
    });
  } catch (error) {
    translateUnique(error);
  }
}

export async function updateBranch(
  id: string,
  input: UpdateBranchInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const existing = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true, code: true, address: true, isActive: true },
  });
  if (!existing) throw notFound();

  if (input.name !== undefined) await assertNameAvailable(input.name, id);
  if (input.code !== undefined && input.code) await assertCodeAvailable(input.code, id);

  const data: Prisma.BranchUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.code !== undefined) data.code = input.code || null;
  if (input.address !== undefined) data.address = input.address || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.branch.update({ where: { id }, data, select: branchSelect });
      const changes = changedFields(existing, row, ["name", "code", "address", "isActive"]);
      if (Object.keys(changes).length) {
        const action =
          changes.isActive !== undefined
            ? row.isActive
              ? AUDIT_ACTIONS.BRANCH_ACTIVATED
              : AUDIT_ACTIONS.BRANCH_DEACTIVATED
            : AUDIT_ACTIONS.BRANCH_UPDATED;
        await createAuditLog(
          { actorId, action, entityType: AUDIT_ENTITY_TYPES.BRANCH, entityId: id, changes, requestContext },
          tx,
        );
      }
      return shape(row);
    });
  } catch (error) {
    translateUnique(error);
  }
}

export async function deleteBranch(id: string, actorId: string, requestContext?: AuditRequestContext) {
  const existing = await prisma.branch.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { departments: true, users: true, tickets: true } } },
  });
  if (!existing) throw notFound();

  const { departments, users, tickets } = existing._count;
  if (departments > 0 || users > 0 || tickets > 0) {
    throw new AppError(409, "BRANCH_IN_USE", "This branch is still referenced and cannot be deleted", {
      departments,
      users,
      tickets,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.branch.delete({ where: { id } });
    await createAuditLog(
      {
        actorId,
        action: AUDIT_ACTIONS.BRANCH_DELETED,
        entityType: AUDIT_ENTITY_TYPES.BRANCH,
        entityId: id,
        changes: { name: { from: existing.name } },
        requestContext,
      },
      tx,
    );
  });
}
