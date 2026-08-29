import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  if (error instanceof AppError) {
    // Surface a retry hint as a standard header when the error carries one
    // (e.g. AI_PROVIDER_RATE_LIMITED). Never exposes provider internals.
    const retryAfter = (error.details as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds;
    if (typeof retryAfter === "number" && Number.isFinite(retryAfter) && retryAfter > 0) {
      response.setHeader("Retry-After", String(Math.ceil(retryAfter)));
    }
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
  });
};
