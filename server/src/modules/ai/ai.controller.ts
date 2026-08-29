import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { TicketParams } from "../tickets/ticket.schema.js";
import type { AiActionInput } from "./ai.schema.js";
import { runTicketAiAction } from "./ai.service.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const runAction: RequestHandler<unknown, unknown, AiActionInput> = async (request, response) => {
  const { id } = response.locals.validatedParams as TicketParams;
  const data = await runTicketAiAction(id, request.body.action, actor(request), {
    locale: request.body.locale,
  });
  response.status(200).json({ data });
};
