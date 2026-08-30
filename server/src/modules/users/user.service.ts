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
  id: true, name: true, email: true, role: true, isActive: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.UserSelect;

function notFound() {
  return new AppError(404, "USER_NOT_FOUND", "User not found");
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

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash, role: input.role }, select: userSelect });
      await createAuditLog({ actorId, action: AUDIT_ACTIONS.USER_CREATED, entityType: AUDIT_ENTITY_TYPES.USER, entityId: user.id, changes: { name: { to: user.name }, email: { to: user.email }, role: { to: user.role }, isActive: { to: user.isActive } }, requestContext }, tx);
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
      select: { id: true, name: true, email: true, role: true, isActive: true },
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

    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined) data.email = input.email;
    if (input.role !== undefined) data.role = input.role;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    try {
      const updated = await tx.user.update({ where: { id }, data, select: userSelect });
      const changes = changedFields(target, updated, ["name", "email", "role", "isActive"]);
      const action = changes.role ? AUDIT_ACTIONS.USER_ROLE_CHANGED : changes.isActive ? (updated.isActive ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED) : AUDIT_ACTIONS.USER_UPDATED;
      if (Object.keys(changes).length) await createAuditLog({ actorId: actor.userId, action, entityType: AUDIT_ENTITY_TYPES.USER, entityId: id, changes, requestContext }, tx);
      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw emailTaken();
      throw error;
    }
  });
}
