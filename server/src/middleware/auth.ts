import type { RequestHandler } from "express";
import type { Role } from "@prisma/client";
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
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
      return;
    }

    next();
  };
}
