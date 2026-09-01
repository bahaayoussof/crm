import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validate.js";
import { agents, overview, sla, tickets } from "./reports.controller.js";
import { reportsAgentsQuerySchema, reportsRangeQuerySchema } from "./reports.schema.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER));

reportsRouter.get("/overview", validateQuery(reportsRangeQuerySchema), overview);
reportsRouter.get("/tickets", validateQuery(reportsRangeQuerySchema), tickets);
reportsRouter.get("/agents", validateQuery(reportsAgentsQuerySchema), agents);
reportsRouter.get("/sla", validateQuery(reportsRangeQuerySchema), sla);

