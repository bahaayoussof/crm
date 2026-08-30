import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validate.js";
import { list } from "./audit-log.controller.js";
import { auditLogQuerySchema } from "./audit-log.schema.js";
export const auditLogRouter = Router();
auditLogRouter.use(requireAuth, requireRole(Role.ADMIN));
auditLogRouter.get("/", validateQuery(auditLogQuerySchema), list);
