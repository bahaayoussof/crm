import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { teamLookup } from "./team.controller.js";

// Active-only lookup for user forms, ticket routing selectors and filters.
// Open to every internal role (mirrors `/api/departments`). Administrative CRUD
// lives on the ADMIN-only settings router (`/api/settings/teams`).
export const teamRouter = Router();
teamRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
teamRouter.get("/", teamLookup);
