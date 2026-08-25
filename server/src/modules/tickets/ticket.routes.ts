import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, createMessage, createNote, detail, list, update } from "./ticket.controller.js";
import { createTicketSchema, ticketConversationBodySchema, ticketListQuerySchema, ticketParamsSchema, updateTicketSchema } from "./ticket.schema.js";

export const ticketRouter = Router();
ticketRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
ticketRouter.get("/", validateQuery(ticketListQuerySchema), list);
ticketRouter.post("/", validateBody(createTicketSchema), create);
ticketRouter.get("/:id", validateParams(ticketParamsSchema), detail);
ticketRouter.patch("/:id", validateParams(ticketParamsSchema), validateBody(updateTicketSchema), update);
ticketRouter.post("/:id/messages", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createMessage);
ticketRouter.post("/:id/notes", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createNote);
