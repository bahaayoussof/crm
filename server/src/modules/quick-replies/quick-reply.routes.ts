import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, detail, list, remove, update } from "./quick-reply.controller.js";
import {
  createQuickReplySchema,
  quickReplyListQuerySchema,
  quickReplyParamsSchema,
  updateQuickReplySchema,
} from "./quick-reply.schema.js";

export const quickReplyRouter = Router();
quickReplyRouter.use(requireAuth);

const useRoles = requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT);
const manageRoles = requireRole(Role.ADMIN, Role.MANAGER);

quickReplyRouter.get("/", useRoles, validateQuery(quickReplyListQuerySchema), list);
quickReplyRouter.get("/:id", useRoles, validateParams(quickReplyParamsSchema), detail);
quickReplyRouter.post("/", manageRoles, validateBody(createQuickReplySchema), create);
quickReplyRouter.patch("/:id", manageRoles, validateParams(quickReplyParamsSchema), validateBody(updateQuickReplySchema), update);
quickReplyRouter.delete("/:id", manageRoles, validateParams(quickReplyParamsSchema), remove);
