import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../shared/errors/app-error.js";

/**
 * Resolves the caller's CURRENT database role and active state, so a stale JWT
 * cannot keep elevated permissions (or any access) after an administrator
 * changes the account. Runs after `requireAuth` and before `requireRole`, and
 * overwrites `request.auth.role` with the persisted value.
 *
 * Scope: the User Management router. `/auth/me` already re-reads the database;
 * other routers keep JWT-role authorization until token expiry by design (no
 * per-request user lookup on every endpoint).
 */
export const requireActiveUser: RequestHandler = (request, _response, next) => {
  const auth = request.auth;
  if (!auth) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  prisma.user
    .findUnique({ where: { id: auth.userId }, select: { role: true, isActive: true } })
    .then((user) => {
      if (!user || !user.isActive) {
        next(new AppError(401, "ACCOUNT_DEACTIVATED", "This account has been deactivated"));
        return;
      }
      request.auth = { ...auth, role: user.role };
      next();
    })
    .catch(next);
};
