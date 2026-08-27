import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

export const requireCronSecret: RequestHandler = (request, _response, next) => {
  if (!env.CRON_SECRET) {
    next(new AppError(503, "CRON_NOT_CONFIGURED", "SLA monitoring is not configured"));
    return;
  }

  const authorization = request.header("authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(env.CRON_SECRET);
  const suppliedBuffer = Buffer.from(supplied);
  const authorized =
    suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);

  if (!authorized) {
    next(new AppError(401, "CRON_AUTHENTICATION_REQUIRED", "Valid cron authentication is required"));
    return;
  }

  next();
};
