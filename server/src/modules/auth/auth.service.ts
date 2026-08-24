import bcrypt from "bcrypt";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createAccessToken } from "./auth-token.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import type { AuthResponse, AuthUser } from "./auth.types.js";

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
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

  const { passwordHash: _passwordHash, ...safeUser } = user;
  void _passwordHash;
  return createAuthResponse(safeUser);
}

export async function getCurrentUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: authUserSelect });

  if (!user) {
    throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
  }

  return toAuthUser(user);
}
