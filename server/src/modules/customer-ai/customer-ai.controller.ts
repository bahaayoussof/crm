import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { CustomerAiChatInput, CustomerAiHandoffInput } from "./customer-ai.schema.js";
import * as service from "./customer-ai.service.js";

function userId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}
export const chat: RequestHandler<unknown, unknown, CustomerAiChatInput> = async (req, res) => res.json({ data: await service.chat(req.body) });
export const handoff: RequestHandler<unknown, unknown, CustomerAiHandoffInput> = async (req, res) => res.status(201).json({ data: await service.handoff(req.body, userId(req)) });
