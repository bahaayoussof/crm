import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, createMessage, createNote, detail, list, update } from "./ticket.controller.js";
import { createTicketSchema, ticketConversationBodySchema, ticketListQuerySchema, ticketParamsSchema, updateTicketSchema } from "./ticket.schema.js";
import {
  listMessageAttachments,
  listTicketAttachments,
  uploadMessageAttachment,
  uploadTicketAttachment,
} from "../attachments/attachment.controller.js";
import { messageAttachmentParamsSchema, ticketAttachmentParamsSchema } from "../attachments/attachment.schema.js";

export const ticketRouter = Router();
ticketRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
ticketRouter.get("/", validateQuery(ticketListQuerySchema), list);
ticketRouter.post("/", validateBody(createTicketSchema), create);
ticketRouter.get("/:id", validateParams(ticketParamsSchema), detail);
ticketRouter.patch("/:id", validateParams(ticketParamsSchema), validateBody(updateTicketSchema), update);
ticketRouter.post("/:id/messages", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createMessage);
ticketRouter.post("/:id/notes", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createNote);

// feature/attachments — secure per-context attachment upload/listing
ticketRouter.get("/:ticketId/attachments", validateParams(ticketAttachmentParamsSchema), listTicketAttachments);
ticketRouter.post("/:ticketId/attachments", validateParams(ticketAttachmentParamsSchema), uploadTicketAttachment);
ticketRouter.get(
  "/:ticketId/messages/:messageId/attachments",
  validateParams(messageAttachmentParamsSchema),
  listMessageAttachments,
);
ticketRouter.post(
  "/:ticketId/messages/:messageId/attachments",
  validateParams(messageAttachmentParamsSchema),
  uploadMessageAttachment,
);
