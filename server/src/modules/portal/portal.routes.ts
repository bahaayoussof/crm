import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireFreshToken } from "../../middleware/require-fresh-token.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import * as controller from "./portal.controller.js";
import { portalCreateTicketSchema, portalProfileUpdateSchema, portalReplySchema, portalTicketListSchema, portalTicketParamsSchema } from "./portal.schema.js";
import {
  listPortalTicketAttachments,
  uploadPortalTicketAttachment,
} from "../attachments/attachment.portal.controller.js";
import * as feedbackController from "../feedback/feedback.controller.js";
import { feedbackParamsSchema, submitFeedbackSchema } from "../feedback/feedback.schema.js";
import * as liveChatController from "../live-chat/live-chat.controller.js";
import { liveChatEndParamsSchema, liveChatStartSchema } from "../live-chat/live-chat.schema.js";
import * as customerAiController from "../customer-ai/customer-ai.controller.js";
import { customerAiChatSchema, customerAiHandoffSchema } from "../customer-ai/customer-ai.schema.js";
import { customerAiRateLimit } from "../customer-ai/customer-ai-rate-limit.js";

export const portalRouter = Router();
portalRouter.use(requireAuth, requireRole(Role.CUSTOMER), requireFreshToken);
portalRouter.get("/overview", controller.overview);
portalRouter.post("/ai/chat", customerAiRateLimit, validateBody(customerAiChatSchema), customerAiController.chat);
portalRouter.post("/ai/handoff", validateBody(customerAiHandoffSchema), customerAiController.handoff);

// feature/live-chat — the Live Chat channel is an ordinary LIVE_CHAT Ticket.
// These two endpoints only bootstrap the portal experience (resume / start);
// messages go through the shared `POST /portal/tickets/:id/messages`.
portalRouter.get("/live-chat", liveChatController.get);
portalRouter.get("/live-chat/departments", liveChatController.departments);
portalRouter.post("/live-chat", validateBody(liveChatStartSchema), liveChatController.start);
portalRouter.post("/live-chat/:ticketId/end", validateParams(liveChatEndParamsSchema), liveChatController.end);
portalRouter.get("/profile", controller.profile);
portalRouter.patch("/profile", validateBody(portalProfileUpdateSchema), controller.updateProfile);
portalRouter.get("/categories", controller.categories);
portalRouter.get("/tickets", validateQuery(portalTicketListSchema), controller.tickets);
portalRouter.get("/tickets/:id", validateParams(portalTicketParamsSchema), controller.detail);
portalRouter.post("/tickets", validateBody(portalCreateTicketSchema), controller.create);
portalRouter.post("/tickets/:id/messages", validateParams(portalTicketParamsSchema), validateBody(portalReplySchema), controller.reply);

// feature/attachments — owned-ticket attachments (upload only while not CLOSED; never creates a message or reopens)
portalRouter.get("/tickets/:id/attachments", validateParams(portalTicketParamsSchema), listPortalTicketAttachments);
portalRouter.post("/tickets/:id/attachments", validateParams(portalTicketParamsSchema), uploadPortalTicketAttachment);

// feature/customer-feedback — one immutable rating (1–5) + optional comment per owned RESOLVED/CLOSED ticket
portalRouter.get("/tickets/:id/feedback", validateParams(feedbackParamsSchema), feedbackController.get);
portalRouter.post("/tickets/:id/feedback", validateParams(feedbackParamsSchema), validateBody(submitFeedbackSchema), feedbackController.submit);
