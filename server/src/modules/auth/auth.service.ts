import bcrypt from "bcrypt";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { changedFields, createAuditLog } from "../audit-logs/audit-log.service.js";
import { createAccessToken } from "./auth-token.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  SelfProfileUpdateInput,
} from "./auth.schema.js";
import type { AuthResponse, AuthUser } from "./auth.types.js";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  passwordChangedAt: true,
  customerProfile: {
    select: { id: true, name: true, email: true, phone: true },
  },
} satisfies Prisma.UserSelect;

type SelectedUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

function toAuthUser(user: SelectedUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    customer: user.customerProfile,
  };
}

function createAuthResponse(user: SelectedUser): AuthResponse {
  return {
    token: createAccessToken(user),
    user: toAuthUser(user),
  };
}

export async function registerCustomer(input: RegisterInput): Promise<AuthResponse> {
  const [existingUser, existingCustomer] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }),
    prisma.customer.findUnique({ where: { email: input.email }, select: { id: true } }),
  ]);

  if (existingUser || existingCustomer) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          role: Role.CUSTOMER,
        },
        select: { id: true },
      });

      await transaction.customer.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone,
          userId: createdUser.id,
        },
      });

      return transaction.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        select: authUserSelect,
      });
    });

    return createAuthResponse(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...authUserSelect, passwordHash: true },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (!user.isActive) {
    throw new AppError(403, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  }

  const { passwordHash: _passwordHash, ...safeUser } = user;
  void _passwordHash;
  return createAuthResponse(safeUser);
}

export async function getCurrentUser(userId: string, issuedAt?: number): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authUserSelect });

  if (!user) {
    throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
  }

  if (!user.isActive) {
    throw new AppError(401, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  }

  // Stale-token check: a token minted before the last password change is dead.
  if (
    user.passwordChangedAt &&
    typeof issuedAt === "number" &&
    issuedAt * 1000 < user.passwordChangedAt.getTime() - 1000
  ) {
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  return toAuthUser(user);
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  requestContext?: AuditRequestContext,
): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, "ACCOUNT_DEACTIVATED", "This account has been deactivated");
  }

  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new AppError(401, "INVALID_PASSWORD", "The current password is incorrect");
  }

  if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
    throw new AppError(422, "SAME_PASSWORD", "New password must be different from the current password");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordChangedAt: new Date() },
  });

  await createAuditLog({
    actorId: user.id,
    action: AUDIT_ACTIONS.PASSWORD_CHANGED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: user.id,
    requestContext,
  });

  // Fresh token so the caller's own session survives the passwordChangedAt bump.
  return { token: createAccessToken(user) };
}

const selfProfileSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  passwordChangedAt: true,
  customerProfile: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.UserSelect;

export type SelfProfile = {
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
  passwordChangedAt: string | null;
};

type SelfProfileUser = Prisma.UserGetPayload<{ select: typeof selfProfileSelect }>;

/**
 * For a CUSTOMER the linked Customer row is the display source of truth
 * (name/email/phone are kept in sync there); internal roles read straight
 * off the User row.
 */
function toSelfProfile(user: SelfProfileUser): SelfProfile {
  const customer = user.customerProfile;
  return {
    name: customer?.name ?? user.name,
    email: customer?.email ?? user.email,
    phone: customer ? customer.phone : user.phone,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
  };
}

export async function getSelfProfile(userId: string): Promise<SelfProfile> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: selfProfileSelect });
  if (!user || !user.isActive) {
    throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
  }
  return toSelfProfile(user);
}

export async function updateSelfProfile(
  userId: string,
  input: SelfProfileUpdateInput,
  requestContext?: AuditRequestContext,
): Promise<SelfProfile> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: selfProfileSelect });
  if (!current || !current.isActive) {
    throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
  }

  const before = toSelfProfile(current);
  const nextName = input.name;
  const nextEmail = input.email;
  const nextPhone = input.phone === undefined ? before.phone : input.phone;

  if (nextEmail !== before.email) {
    const [userClash, customerClash] = await Promise.all([
      prisma.user.findFirst({ where: { email: nextEmail, NOT: { id: userId } }, select: { id: true } }),
      prisma.customer.findFirst({ where: { email: nextEmail, NOT: { userId } }, select: { id: true } }),
    ]);
    if (userClash || customerClash) {
      throw new AppError(409, "EMAIL_IN_USE", "This email is already in use");
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { name: nextName, email: nextEmail, phone: nextPhone },
      });
      if (current.customerProfile) {
        await tx.customer.update({
          where: { id: current.customerProfile.id },
          data: { name: nextName, email: nextEmail, phone: nextPhone },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_IN_USE", "This email is already in use");
    }
    throw error;
  }

  const after: SelfProfile = { ...before, name: nextName, email: nextEmail, phone: nextPhone };

  await createAuditLog({
    actorId: userId,
    action: AUDIT_ACTIONS.PROFILE_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: userId,
    changes: changedFields(
      { name: before.name, email: before.email, phone: before.phone },
      { name: after.name, email: after.email, phone: after.phone },
      ["name", "email", "phone"],
    ),
    requestContext,
  });

  return after;
}
