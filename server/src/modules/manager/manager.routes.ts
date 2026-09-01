import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateParams, validateQuery } from "../../middleware/validate.js";
import { agentDetail, overview, team } from "./manager.controller.js";
import { managerAgentParamsSchema, managerTeamQuerySchema } from "./manager.schema.js";

export const managerRouter = Router();

// Manager Work Console. ADMIN is included so an admin can inspect the console;
// AGENT / CUSTOMER receive 403. Data scope is organization-wide today — see
// `managerTicketScopeWhere` in manager.service.ts and the ADR in docs/17.
managerRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER));

managerRouter.get("/overview", overview);
managerRouter.get("/team", validateQuery(managerTeamQuerySchema), team);
managerRouter.get("/team/:agentId", validateParams(managerAgentParamsSchema), agentDetail);
