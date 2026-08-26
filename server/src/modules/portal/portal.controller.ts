import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { PortalCreateTicketInput, PortalReplyInput, PortalTicketListQuery, PortalTicketParams } from "./portal.schema.js";
import * as portal from "./portal.service.js";

function userId(request: Express.Request) { if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"); return request.auth.userId; }
export const overview: RequestHandler = async (req, res) => res.json({ data: await portal.overview(userId(req)) });
export const categories: RequestHandler = async (req, res) => res.json({ data: await portal.categories(userId(req)) });
export const tickets: RequestHandler = async (req, res) => res.json(await portal.tickets(res.locals.validatedQuery as PortalTicketListQuery, userId(req)));
export const detail: RequestHandler = async (req, res) => res.json({ data: await portal.ticketDetail((res.locals.validatedParams as PortalTicketParams).id, userId(req)) });
export const create: RequestHandler<unknown, unknown, PortalCreateTicketInput> = async (req, res) => res.status(201).json({ data: await portal.createTicket(req.body, userId(req)) });
export const reply: RequestHandler<unknown, unknown, PortalReplyInput> = async (req, res) => res.status(201).json({ data: await portal.reply((res.locals.validatedParams as PortalTicketParams).id, req.body, userId(req)) });
