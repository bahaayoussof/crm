import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateTicketInput, TicketConversationInput, TicketListQuery, TicketParams, UpdateTicketInput } from "./ticket.schema.js";
import { addTicketMessage, addTicketNote, createTicket, getTicket, listTickets, updateTicket } from "./ticket.service.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const list: RequestHandler = async (request, response) => response.status(200).json(await listTickets(response.locals.validatedQuery as TicketListQuery, actor(request)));
export const detail: RequestHandler = async (request, response) => response.status(200).json({ data: await getTicket((response.locals.validatedParams as TicketParams).id, actor(request)) });
export const create: RequestHandler<unknown, unknown, CreateTicketInput> = async (request, response) => response.status(201).json({ data: await createTicket(request.body, actor(request)) });
export const update: RequestHandler<unknown, unknown, UpdateTicketInput> = async (request, response) => response.status(200).json({ data: await updateTicket((response.locals.validatedParams as TicketParams).id, request.body, actor(request)) });
export const createMessage: RequestHandler<unknown, unknown, TicketConversationInput> = async (request, response) => response.status(201).json({ data: await addTicketMessage((response.locals.validatedParams as TicketParams).id, request.body, actor(request)) });
export const createNote: RequestHandler<unknown, unknown, TicketConversationInput> = async (request, response) => response.status(201).json({ data: await addTicketNote((response.locals.validatedParams as TicketParams).id, request.body, actor(request)) });
