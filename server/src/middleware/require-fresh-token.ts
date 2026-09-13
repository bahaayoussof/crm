import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../shared/errors/app-error.js";

/**
 * Rejects an access token that was issued before the account's last password
 * change, so a password reset / change immediately invalidates every OTHER
 * session for that user.
 *
 * Runs after `requireAuth`. Retained on profile/Portal routes as defense in
 * depth; the shared `requireRole` guard now performs the same freshness check
 * for every role-protected API.
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
