import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { branchLookup } from "./branch.controller.js";

// Active-only lookup for assignment selectors, ticket filters and reports.
// Open to every internal role (mirrors `/api/categories`). Administrative CRUD
// lives on the ADMIN-only settings router.
export const branchRouter = Router();
branchRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
branchRouter.get("/", branchLookup);
