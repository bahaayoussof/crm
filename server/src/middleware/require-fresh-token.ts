import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../shared/errors/app-error.js";

/**
 * Rejects an access token that was issued before the account's last password
 * change, so a password reset / change immediately invalidates every OTHER
 * session for that user.
 *
 * Runs after `requireAuth`. Scope: the customer portal router only. `/auth/me`
 * performs the same check inside `getCurrentUser` (it already reads the user
 * row). Global `requireAuth` is deliberately NOT modified — a DB-backed
 * `requireAuth` would break the many module test suites that mock prisma
 * without `user.findUnique` (see `.wolf/cerebrum.md`). All other internal
 * routes remain bounded by the 8h JWT expiry.
 */
export const requireFreshToken: RequestHandler = (request, _response, next) => {
  const auth = request.auth;
  if (!auth) {
    next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  prisma.user
    .findUnique({ where: { id: auth.userId }, select: { passwordChangedAt: true } })
    .then((user) => {
      if (
        user?.passwordChangedAt &&
        auth.issuedAt * 1000 < user.passwordChangedAt.getTime() - 1000
      ) {
        next(new AppError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again."));
        return;
      }
      next();
    })
    .catch(next);
};
