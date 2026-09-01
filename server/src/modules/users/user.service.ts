import bcrypt from "bcrypt";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateUserInput, UpdateUserInput, UserListQuery } from "./user.schema.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";

// Administrative surface for internal identities only.
const internalRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.AGENT];

const userSelect = {
  id: true, name: true, email: true, role: true, isActive: true, phone: true,
  departmentId: true, branchId: true, teamId: true,
  department: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  team: { select: { id: true, name: true, departmentId: true } },
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

function notFound() {
  return new AppError(404, "USER_NOT_FOUND", "User not found");
}

/**
 * Validates a department/branch assignment for an internal user. Both are
 * optional; when set they must exist and be active. When both are set the
 * department must belong to the chosen branch (matches the ticket rule and the
 * SLA auto-assignment eligibility check).
 */
async function assertOrgAssignment(
  tx: Prisma.TransactionClient,
  assignment: { departmentId: string | null; branchId: string | null },
) {
  const department = assignment.departmentId
    ? await tx.department.findUnique({ where: { id: assignment.departmentId }, select: { id: true, isActive: true, branchId: true } })
    : null;
  if (assignment.departmentId && (!department || !department.isActive)) {
    throw new AppError(400, "INVALID_DEPARTMENT", "Department is invalid or inactive");
  }
  const branch = assignment.branchId
    ? await tx.branch.findUnique({ where: { id: assignment.branchId }, select: { id: true, isActive: true } })
    : null;
  if (assignment.branchId && (!branch || !branch.isActive)) {
    throw new AppError(400, "INVALID_BRANCH", "Branch is invalid or inactive");
  }
  if (department && assignment.branchId && department.branchId !== assignment.branchId) {
    throw new AppError(400, "DEPARTMENT_BRANCH_MISMATCH", "Department does not belong to the selected branch");
  }
}

function orgConnect(id: string | null | undefined) {
  if (id === undefined) return undefined;
  return id ? { connect: { id } } : { disconnect: true };
}

/**
 * Validates a team assignment for an internal user and, for a MANAGER, keeps
 * `Team.managerId` in sync (V1: one manager per team, one team per manager).
 * Call inside the same transaction as the user write; the caller still sets
 * `user.teamId` via `data.team`. `effectiveDepartmentId` is the department the
 * user will have after this update.
 */
async function assertTeamAssignment(
  tx: Prisma.TransactionClient,
  target: { id: string; role: Role },
  teamId: string,
  effectiveDepartmentId: string | null,
) {
  const team = await tx.team.findUnique({
    where: { id: teamId },
    select: { id: true, isActive: true, departmentId: true, managerId: true },
  });
  if (!team || !team.isActive) throw new AppError(400, "INVALID_TEAM", "Team is invalid or inactive");
  if (effectiveDepartmentId && team.departmentId !== effectiveDepartmentId) {
    throw new AppError(400, "TEAM_DEPARTMENT_MISMATCH", "Team does not belong to the user's department");
  }
  if (target.role === Role.MANAGER) {
    if (team.managerId && team.managerId !== target.id) {
      throw new AppError(409, "TEAM_ALREADY_HAS_MANAGER", "This team already has a manager");
    }
    // Free any team this manager previously led, then take this one.
    await tx.team.updateMany({ where: { managerId: target.id, id: { not: teamId } }, data: { managerId: null } });
    if (team.managerId !== target.id) {
      await tx.team.update({ where: { id: teamId }, data: { managerId: target.id } });
    }
  }
}

/** Clearing a MANAGER's team also vacates the team they led. */
async function releaseManagedTeam(tx: Prisma.TransactionClient, target: { id: string; role: Role }) {
  if (target.role !== Role.MANAGER) return;
  await tx.team.updateMany({ where: { managerId: target.id }, data: { managerId: null } });
}

/**
 * Blocks moving an AGENT between teams while they still hold active tickets on
 * their current team — never silently orphans a ticket/assignee cross-team pair.
 */
async function assertAgentTeamMoveSafe(
  tx: Prisma.TransactionClient,
  target: { id: string; role: Role; teamId: string | null },
  nextTeamId: string | null,
) {
  if (target.role !== Role.AGENT) return;
  if (nextTeamId === target.teamId) return;
  const activeOnOldTeam = await tx.ticket.count({
    where: {
      assignedAgentId: target.id,
      teamId: target.teamId,
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED"] },
    },
  });
  if (activeOnOldTeam > 0) {
    throw new AppError(
      409,
      "AGENT_HAS_ACTIVE_TICKETS",
      "Reassign this agent's active tickets before moving them to another team",
      { activeTickets: activeOnOldTeam },
    );
  }
}

function emailTaken() {
  return new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
}

function searchWhere(search: string): Prisma.UserWhereInput {
  return { OR: [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
  ] };
}

export async function listUsers(query: UserListQuery) {
  const where: Prisma.UserWhereInput = {
    role: query.role ? query.role : { in: internalRoles },
    ...(query.status && { isActive: query.status === "active" }),
    ...(query.search && { AND: [searchWhere(query.search)] }),
  };

  const [records, total] = await prisma.$transaction([
    prisma.user.findMany({
      where, skip: (query.page - 1) * query.limit, take: query.limit,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: userSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { data: records, meta: { page: query.page, limit: query.limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / query.limit) } };
}

export async function getUser(id: string) {
  const record = await prisma.user.findFirst({ where: { id, role: { in: internalRoles } }, select: userSelect });
  if (!record) throw notFound();
  return record;
}

export async function createUser(input: CreateUserInput, actorId: string, requestContext?: AuditRequestContext) {
  const existing = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
  if (existing) throw emailTaken();

  const passwordHash = await bcrypt.hash(input.password, 12);
  const departmentId = input.departmentId ?? null;
  const branchId = input.branchId ?? null;
  const teamId = input.teamId ?? null;

  try {
    return await prisma.$transaction(async (tx) => {
      await assertOrgAssignment(tx, { departmentId, branchId });
      const created = await tx.user.create({
        data: {
          name: input.name, email: input.email, passwordHash, role: input.role,
          ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
          ...(branchId ? { branch: { connect: { id: branchId } } } : {}),
          ...(teamId ? { team: { connect: { id: teamId } } } : {}),
        },
        select: userSelect,
      });
      let user = created;
      if (teamId) {
        await assertTeamAssignment(tx, { id: created.id, role: created.role }, teamId, departmentId);
        user = await tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
      }
      await createAuditLog({ actorId, action: AUDIT_ACTIONS.USER_CREATED, entityType: AUDIT_ENTITY_TYPES.USER, entityId: user.id, changes: { name: { to: user.name }, email: { to: user.email }, role: { to: user.role }, isActive: { to: user.isActive }, departmentId: { to: user.departmentId }, branchId: { to: user.branchId }, teamId: { to: user.teamId } }, requestContext }, tx);
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw emailTaken();
    throw error;
  }
}

/**
 * Single safe update path (name / email / role / isActive). Read-check-write runs
 * inside one transaction so the self-management and last-active-ADMIN invariants
 * cannot be raced. Only submitted fields are written.
 */
export async function updateUser(id: string, input: UpdateUserInput, actor: { userId: string }, requestContext?: AuditRequestContext) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: { id, role: { in: internalRoles } },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, departmentId: true, branchId: true, teamId: true },
    });
    if (!target) throw notFound();

    const roleChanges = input.role !== undefined && input.role !== target.role;
    const deactivating = input.isActive === false && target.isActive;

    // Self-management safety — an administrator cannot demote or disable themselves.
    if (id === actor.userId) {
      if (roleChanges) {
        throw new AppError(409, "SELF_ROLE_CHANGE_FORBIDDEN", "You cannot change your own role");
      }
      if (input.isActive === false) {
        throw new AppError(409, "SELF_DEACTIVATION_FORBIDDEN", "You cannot deactivate your own account");
      }
    }

    // Keep at least one active ADMIN. Only relevant when this row is currently an
    // active ADMIN and the change would remove them from that set.
    const removesActiveAdmin =
      target.role === Role.ADMIN && target.isActive &&
      ((roleChanges && input.role !== Role.ADMIN) || deactivating);
    if (removesActiveAdmin) {
      const otherActiveAdmins = await tx.user.count({
        where: { role: Role.ADMIN, isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw new AppError(409, "LAST_ACTIVE_ADMIN_REQUIRED", "At least one active administrator must remain");
      }
    }

    if (input.email) {
      const emailOwner = await tx.user.findFirst({ where: { email: input.email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== id) throw emailTaken();
    }

    if (input.departmentId !== undefined || input.branchId !== undefined) {
      await assertOrgAssignment(tx, {
        departmentId: input.departmentId !== undefined ? input.departmentId : target.departmentId,
        branchId: input.branchId !== undefined ? input.branchId : target.branchId,
      });
    }

    const nextRole = input.role ?? target.role;

    // Team membership (feature/team-based-manager-scope).
    if (input.teamId !== undefined) {
      const effectiveDepartmentId = input.departmentId !== undefined ? input.departmentId : target.departmentId;
      await assertAgentTeamMoveSafe(tx, { id, role: target.role, teamId: target.teamId }, input.teamId);
      if (input.teamId) {
        await assertTeamAssignment(tx, { id, role: nextRole }, input.teamId, effectiveDepartmentId);
      } else {
        await releaseManagedTeam(tx, { id, role: nextRole });
      }
    } else if (roleChanges && input.role !== Role.MANAGER && target.role === Role.MANAGER) {
      // Demoted out of MANAGER without an explicit team change — vacate any team led.
      await releaseManagedTeam(tx, { id, role: Role.MANAGER });
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.departmentId !== undefined) data.department = orgConnect(input.departmentId);
    if (input.branchId !== undefined) data.branch = orgConnect(input.branchId);
    if (input.teamId !== undefined) data.team = orgConnect(input.teamId);

    try {
      const updated = await tx.user.update({ where: { id }, data, select: userSelect });
      const changes = changedFields(target, updated, ["name", "email", "phone", "role", "isActive", "departmentId", "branchId", "teamId"]);
      const action = changes.role ? AUDIT_ACTIONS.USER_ROLE_CHANGED : changes.isActive ? (updated.isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED) : AUDIT_ACTIONS.USER_UPDATED;
      if (Object.keys(changes).length) await createAuditLog({ actorId: actor.userId, action, entityType: AUDIT_ENTITY_TYPES.USER, entityId: id, changes, requestContext }, tx);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw emailTaken();
      throw error;
    }
  });
}
