import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { overview } from "./dashboard.controller.js";

export const dashboardRouter = Router();
dashboardRouter.get("/overview", requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT), overview);
