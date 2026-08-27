import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { FeedbackParams, SubmitFeedbackInput } from "./feedback.schema.js";
import * as feedback from "./feedback.service.js";

function userId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}

export const get: RequestHandler = async (req, res) =>
  res.json({ data: await feedback.getFeedback((res.locals.validatedParams as FeedbackParams).id, userId(req)) });

export const submit: RequestHandler<unknown, unknown, SubmitFeedbackInput> = async (req, res) =>
  res.status(201).json({ data: await feedback.submitFeedback((res.locals.validatedParams as FeedbackParams).id, req.body, userId(req)) });
