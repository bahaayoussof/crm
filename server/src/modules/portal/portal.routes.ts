import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import * as controller from "./portal.controller.js";
import { portalCreateTicketSchema, portalReplySchema, portalTicketListSchema, portalTicketParamsSchema } from "./portal.schema.js";

export const portalRouter = Router();
portalRouter.use(requireAuth, requireRole(Role.CUSTOMER));
portalRouter.get("/overview", controller.overview);
portalRouter.get("/categories", controller.categories);
portalRouter.get("/tickets", validateQuery(portalTicketListSchema), controller.tickets);
portalRouter.get("/tickets/:id", validateParams(portalTicketParamsSchema), controller.detail);
portalRouter.post("/tickets", validateBody(portalCreateTicketSchema), controller.create);
portalRouter.post("/tickets/:id/messages", validateParams(portalTicketParamsSchema), validateBody(portalReplySchema), controller.reply);
