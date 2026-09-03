import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { assertDeletionAllowedInDemo } from "../../middleware/demo-guard.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import type {
  CreateDepartmentInput,
  DepartmentListQuery,
  UpdateDepartmentInput,
} from "./department.schema.js";

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  branchId: true,
  branch: { select: { id: true, name: true } },
  _count: { select: { users: true, tickets: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepartmentSelect;

type DepartmentRow = Prisma.DepartmentGetPayload<{ select: typeof departmentSelect }>;

function shape(row: DepartmentRow) {
  const { _count, ...rest } = row;
  return { ...rest, userCount: _count.users, ticketCount: _count.tickets };
}

function notFound() {
  return new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found");
}

function nameConflict() {
  return new AppError(409, "DEPARTMENT_NAME_ALREADY_EXISTS", "A department with this name already exists in the selected branch");
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw nameConflict();
  throw error;
}

async function assertBranchExists(branchId: string) {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
  if (!branch) throw new AppError(404, "BRANCH_NOT_FOUND", "Branch not found");
}

async function assertNameAvailable(name: string, branchId: string | null, excludeId?: string) {
  const clash = await prisma.department.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      branchId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw nameConflict();
}

export async function listDepartments(query: DepartmentListQuery) {
  const where: Prisma.DepartmentWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
  };
  const [records, total] = await prisma.$transaction([
    prisma.department.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: departmentSelect,
    }),
    prisma.department.count({ where }),
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

/** Active-only lookup for assignment selectors and filters (all internal roles). */
export async function listActiveDepartments() {
  return prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, branchId: true },
  });
}

export async function createDepartment(
  input: CreateDepartmentInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const branchId = input.branchId ?? null;
  if (branchId) await assertBranchExists(branchId);
  await assertNameAvailable(input.name, branchId);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.department.create({
        data: { name: input.name, description: input.description || null, branchId },
        select: departmentSelect,
      });
      await createAuditLog(
        {
          actorId,
          action: AUDIT_ACTIONS.DEPARTMENT_CREATED,
          entityType: AUDIT_ENTITY_TYPES.DEPARTMENT,
          entityId: row.id,
          changes: {
            name: { to: row.name },
            description: { to: row.description },
            isActive: { to: row.isActive },
            branchId: { to: row.branchId },
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

export async function updateDepartment(
  id: string,
  input: UpdateDepartmentInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const existing = await prisma.department.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isActive: true, branchId: true },
  });
  if (!existing) throw notFound();

  const nextBranchId = input.branchId !== undefined ? input.branchId : existing.branchId;
  const nextName = input.name ?? existing.name;
  if (input.branchId !== undefined && input.branchId) await assertBranchExists(input.branchId);
  if (input.name !== undefined || input.branchId !== undefined) {
    await assertNameAvailable(nextName, nextBranchId, id);
  }

  const data: Prisma.DepartmentUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.branchId !== undefined) {
    data.branch = input.branchId ? { connect: { id: input.branchId } } : { disconnect: true };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.department.update({ where: { id }, data, select: departmentSelect });
      const changes = changedFields(existing, row, ["name", "description", "isActive", "branchId"]);
      if (Object.keys(changes).length) {
        const action =
          changes.isActive !== undefined
            ? row.isActive
              ? AUDIT_ACTIONS.DEPARTMENT_ACTIVATED
              : AUDIT_ACTIONS.DEPARTMENT_DEACTIVATED
            : AUDIT_ACTIONS.DEPARTMENT_UPDATED;
        await createAuditLog(
          {
            actorId,
            action,
            entityType: AUDIT_ENTITY_TYPES.DEPARTMENT,
            entityId: id,
            changes,
            requestContext,
          },
          tx,
        );
      }
      return shape(row);
    });
  } catch (error) {
    translateUnique(error);
  }
}

export async function deleteDepartment(id: string, actorId: string, requestContext?: AuditRequestContext) {
  assertDeletionAllowedInDemo("Department");
  const existing = await prisma.department.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { users: true, tickets: true } } },
  });
  if (!existing) throw notFound();

  const { users, tickets } = existing._count;
  if (users > 0 || tickets > 0) {
    throw new AppError(
      409,
      "DEPARTMENT_IN_USE",
      "This department is still referenced and cannot be deleted",
      { users, tickets },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.department.delete({ where: { id } });
    await createAuditLog(
      {
        actorId,
        action: AUDIT_ACTIONS.DEPARTMENT_DELETED,
        entityType: AUDIT_ENTITY_TYPES.DEPARTMENT,
        entityId: id,
        changes: { name: { from: existing.name } },
        requestContext,
      },
      tx,
    );
  });
}
