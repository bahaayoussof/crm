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
import { unwatch, watch, watchers } from "../collaboration/collaboration.controller.js";
import { runAction as runAiAction } from "../ai/ai.controller.js";
import { aiActionSchema } from "../ai/ai.schema.js";
import { aiRateLimit } from "../ai/ai-rate-limit.js";

export const ticketRouter = Router();
ticketRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
ticketRouter.get("/", validateQuery(ticketListQuerySchema), list);
ticketRouter.post("/", validateBody(createTicketSchema), create);
ticketRouter.get("/:id", validateParams(ticketParamsSchema), detail);
ticketRouter.patch("/:id", validateParams(ticketParamsSchema), validateBody(updateTicketSchema), update);
ticketRouter.post("/:id/messages", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createMessage);
ticketRouter.post("/:id/notes", validateParams(ticketParamsSchema), validateBody(ticketConversationBodySchema), createNote);

// feature/ai-assistant (ADR-034) — internal agent-assistance. Suggestions only:
// this endpoint never mutates the ticket, sends a message, or changes state.
// Inherits requireAuth + ADMIN/MANAGER/AGENT guard; AI context is built server-
// side after the same ticket-visibility check as GET /:id.
ticketRouter.post("/:id/ai", aiRateLimit, validateParams(ticketParamsSchema), validateBody(aiActionSchema), runAiAction);

// feature/team-collaboration — ticket watchers (self-watch / self-unwatch / list).
// Inherits this router's requireAuth + internal-role guard; each handler re-checks
// ticket visibility (hidden ticket → 404 TICKET_NOT_FOUND).
ticketRouter.get("/:id/watchers", validateParams(ticketParamsSchema), watchers);
ticketRouter.post("/:id/watchers", validateParams(ticketParamsSchema), watch);
ticketRouter.delete("/:id/watchers/me", validateParams(ticketParamsSchema), unwatch);

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
