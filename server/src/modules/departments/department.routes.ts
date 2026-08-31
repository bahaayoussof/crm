import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { departmentLookup } from "./department.controller.js";

// Active-only lookup for assignment selectors, ticket filters and reports.
// Open to every internal role (mirrors `/api/categories`). Administrative CRUD
// lives on the ADMIN-only settings router.
export const departmentRouter = Router();
departmentRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
departmentRouter.get("/", departmentLookup);
