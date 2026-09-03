import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { assertDeletionAllowedInDemo } from "../../middleware/demo-guard.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import type { CreateTeamInput, TeamListQuery, UpdateTeamInput } from "./team.schema.js";

const teamSelect = {
  id: true,
  name: true,
  isActive: true,
  departmentId: true,
  managerId: true,
  department: { select: { id: true, name: true, branchId: true } },
  manager: { select: { id: true, name: true, email: true } },
  _count: { select: { members: true, tickets: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamSelect;

type TeamRow = Prisma.TeamGetPayload<{ select: typeof teamSelect }>;

function shape(row: TeamRow) {
  const { _count, ...rest } = row;
  return { ...rest, agentCount: _count.members, ticketCount: _count.tickets };
}

function notFound() {
  return new AppError(404, "TEAM_NOT_FOUND", "Team not found");
}

function nameConflict() {
  return new AppError(409, "TEAM_NAME_ALREADY_EXISTS", "A team with this name already exists in the selected department");
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw nameConflict();
  throw error;
}

async function assertDepartment(departmentId: string) {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, isActive: true, branchId: true },
  });
  if (!department || !department.isActive) {
    throw new AppError(400, "INVALID_DEPARTMENT", "Department is invalid or inactive");
  }
  return department;
}

/**
 * A team's manager must be an active MANAGER who does not already lead another
 * team (V1: one team per manager). `currentTeamId` exempts the team being edited.
 */
async function assertManagerAvailable(managerId: string, currentTeamId?: string) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, role: true, isActive: true, managedTeam: { select: { id: true } } },
  });
  if (!manager || manager.role !== Role.MANAGER || !manager.isActive) {
    throw new AppError(400, "INVALID_TEAM_MANAGER", "The selected user is not an active manager");
  }
  if (manager.managedTeam && manager.managedTeam.id !== currentTeamId) {
    throw new AppError(409, "MANAGER_ALREADY_LEADS_TEAM", "This manager already leads another team");
  }
}

async function assertNameAvailable(name: string, departmentId: string, excludeId?: string) {
  const clash = await prisma.team.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      departmentId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) throw nameConflict();
}

export async function listTeams(query: TeamListQuery) {
  const where: Prisma.TeamWhereInput = {
    ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
  };
  const [records, total] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: teamSelect,
    }),
    prisma.team.count({ where }),
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

/** Active-only lookup for team selectors (all internal roles). */
export async function listActiveTeams(departmentId?: string) {
  return prisma.team.findMany({
    where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, departmentId: true, managerId: true },
  });
}

export async function createTeam(input: CreateTeamInput, actorId: string, requestContext?: AuditRequestContext) {
  const department = await assertDepartment(input.departmentId);
  const managerId = input.managerId ?? null;
  if (managerId) await assertManagerAvailable(managerId);
  await assertNameAvailable(input.name, input.departmentId);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.team.create({
        data: {
          name: input.name,
          department: { connect: { id: input.departmentId } },
          ...(managerId ? { manager: { connect: { id: managerId } } } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        select: teamSelect,
      });
      // Keep the manager's own membership in sync (Phase 5): a team's manager
      // belongs to that team, and inherits its department/branch.
      if (managerId) {
        await tx.user.update({
          where: { id: managerId },
          data: { teamId: row.id, departmentId: department.id, branchId: department.branchId },
        });
      }
      await createAuditLog(
        {
          actorId,
          action: AUDIT_ACTIONS.TEAM_CREATED,
          entityType: AUDIT_ENTITY_TYPES.TEAM,
          entityId: row.id,
          changes: {
            name: { to: row.name },
            departmentId: { to: row.departmentId },
            managerId: { to: row.managerId },
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

export async function updateTeam(
  id: string,
  input: UpdateTeamInput,
  actorId: string,
  requestContext?: AuditRequestContext,
) {
  const existing = await prisma.team.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isActive: true,
      departmentId: true,
      managerId: true,
      _count: { select: { tickets: true } },
    },
  });
  if (!existing) throw notFound();

  const nextDepartmentId = input.departmentId ?? existing.departmentId;
  const nextName = input.name ?? existing.name;

  if (input.departmentId !== undefined && input.departmentId !== existing.departmentId) {
    if (existing._count.tickets > 0) {
      throw new AppError(
        409,
        "TEAM_HAS_TICKETS",
        "Reassign this team's tickets before moving it to another department",
        { tickets: existing._count.tickets },
      );
    }
    await assertDepartment(input.departmentId);
  }
  const department = await assertDepartment(nextDepartmentId);
  if (input.name !== undefined || input.departmentId !== undefined) {
    await assertNameAvailable(nextName, nextDepartmentId, id);
  }

  const managerChanges = input.managerId !== undefined && input.managerId !== existing.managerId;
  if (managerChanges && input.managerId) await assertManagerAvailable(input.managerId, id);

  const data: Prisma.TeamUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.departmentId !== undefined) data.department = { connect: { id: input.departmentId } };
  if (input.managerId !== undefined) {
    data.manager = input.managerId ? { connect: { id: input.managerId } } : { disconnect: true };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.team.update({ where: { id }, data, select: teamSelect });

      if (managerChanges) {
        // Detach the outgoing manager from the team roster.
        if (existing.managerId) {
          await tx.user.update({ where: { id: existing.managerId }, data: { teamId: null } });
        }
        // Attach the incoming manager (Phase 5).
        if (input.managerId) {
          await tx.user.update({
            where: { id: input.managerId },
            data: { teamId: row.id, departmentId: department.id, branchId: department.branchId },
          });
        }
      }

      const changes = changedFields(existing, row, ["name", "isActive", "departmentId", "managerId"]);
      if (Object.keys(changes).length) {
        const action = changes.managerId
          ? AUDIT_ACTIONS.TEAM_MANAGER_CHANGED
          : changes.isActive !== undefined
            ? row.isActive
              ? AUDIT_ACTIONS.TEAM_ACTIVATED
              : AUDIT_ACTIONS.TEAM_DEACTIVATED
            : AUDIT_ACTIONS.TEAM_UPDATED;
        await createAuditLog(
          { actorId, action, entityType: AUDIT_ENTITY_TYPES.TEAM, entityId: id, changes, requestContext },
          tx,
        );
      }
      return shape(row);
    });
  } catch (error) {
    translateUnique(error);
  }
}

export async function deleteTeam(id: string, actorId: string, requestContext?: AuditRequestContext) {
  assertDeletionAllowedInDemo("Team");
  const existing = await prisma.team.findUnique({
    where: { id },
    select: { id: true, name: true, managerId: true, _count: { select: { members: true, tickets: true } } },
  });
  if (!existing) throw notFound();

  const { members, tickets } = existing._count;
  if (members > 0 || tickets > 0) {
    throw new AppError(409, "TEAM_IN_USE", "This team still has members or tickets and cannot be deleted", {
      members,
      tickets,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (existing.managerId) {
      await tx.user.update({ where: { id: existing.managerId }, data: { teamId: null } });
    }
    await tx.team.delete({ where: { id } });
    await createAuditLog(
      {
        actorId,
        action: AUDIT_ACTIONS.TEAM_DELETED,
        entityType: AUDIT_ENTITY_TYPES.TEAM,
        entityId: id,
        changes: { name: { from: existing.name } },
        requestContext,
      },
      tx,
    );
  });
}
