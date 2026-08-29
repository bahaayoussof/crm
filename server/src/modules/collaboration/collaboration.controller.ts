import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { TicketParams } from "../tickets/ticket.schema.js";
import type { MentionableQuery } from "./collaboration.schema.js";
import {
  listMentionableUsers,
  listWatchers,
  unwatchTicket,
  watchTicket,
} from "./collaboration.service.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const ticketId = (response: Response) => (response.locals.validatedParams as TicketParams).id;

export const mentionable: RequestHandler = async (_request, response) =>
  response
    .status(200)
    .json({ data: await listMentionableUsers(response.locals.validatedQuery as MentionableQuery) });

export const watchers: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await listWatchers(ticketId(response), actor(request)) });

export const watch: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await watchTicket(ticketId(response), actor(request)) });

export const unwatch: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await unwatchTicket(ticketId(response), actor(request)) });
