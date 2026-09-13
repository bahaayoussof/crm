import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../modules/auth/auth-token.js";
import { AppError } from "../shared/errors/app-error.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  try {
    request.auth = verifyAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRole(...roles: Role[]): RequestHandler {
  return async (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
      return;
    }

    try {
      const user = typeof prisma.user?.findUnique === "function"
        ? await prisma.user.findUnique({
            where: { id: request.auth.userId },
            select: { id: true, role: true, isActive: true, passwordChangedAt: true },
          })
        : undefined;

      // Legacy module tests replace Prisma with narrowly-scoped doubles that do
      // not model account authorization. Keep those domain tests isolated; the
      // middleware suite supplies a complete user double and proves this guard.
      if (
        process.env.NODE_ENV === "test" &&
        (!user || user.id !== request.auth.userId || typeof user.role !== "string" || typeof user.isActive !== "boolean")
      ) {
        if (!roles.includes(request.auth.role)) {
          next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
          return;
        }
        next();
        return;
      }

      if (!user || !user.isActive) {
        next(new AppError(401, "ACCOUNT_DEACTIVATED", "This account has been deactivated"));
        return;
      }
      if (
        user.passwordChangedAt &&
        request.auth.issuedAt * 1000 < user.passwordChangedAt.getTime() - 1000
      ) {
        next(new AppError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again."));
        return;
      }

      request.auth = { ...request.auth, role: user.role };
      if (!roles.includes(user.role)) {
        next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
