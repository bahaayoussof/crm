import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import * as controller from "./portal.controller.js";
import { portalCreateTicketSchema, portalReplySchema, portalTicketListSchema, portalTicketParamsSchema } from "./portal.schema.js";
import {
  listPortalTicketAttachments,
  uploadPortalTicketAttachment,
} from "../attachments/attachment.portal.controller.js";
import * as feedbackController from "../feedback/feedback.controller.js";
import { feedbackParamsSchema, submitFeedbackSchema } from "../feedback/feedback.schema.js";

export const portalRouter = Router();
portalRouter.use(requireAuth, requireRole(Role.CUSTOMER));
portalRouter.get("/overview", controller.overview);
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
