import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../shared/errors/app-error.js";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid request data", result.error.flatten()));
      return;
    }

    request.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid query parameters", result.error.flatten()));
      return;
    }

    response.locals.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      next(new AppError(400, "VALIDATION_ERROR", "Invalid route parameters", result.error.flatten()));
      return;
    }

    response.locals.validatedParams = result.data;
    next();
  };
}
