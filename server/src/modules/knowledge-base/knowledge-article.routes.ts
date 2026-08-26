import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, detail, list, remove, update } from "./knowledge-article.controller.js";
import {
  createKnowledgeArticleSchema,
  knowledgeArticleListQuerySchema,
  knowledgeArticleParamsSchema,
  updateKnowledgeArticleSchema,
} from "./knowledge-article.schema.js";

export const knowledgeArticleRouter = Router();
knowledgeArticleRouter.use(requireAuth);

const readRoles = requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT);
const manageRoles = requireRole(Role.ADMIN, Role.MANAGER);

knowledgeArticleRouter.get("/", readRoles, validateQuery(knowledgeArticleListQuerySchema), list);
knowledgeArticleRouter.get("/:id", readRoles, validateParams(knowledgeArticleParamsSchema), detail);
knowledgeArticleRouter.post("/", manageRoles, validateBody(createKnowledgeArticleSchema), create);
knowledgeArticleRouter.patch("/:id", manageRoles, validateParams(knowledgeArticleParamsSchema), validateBody(updateKnowledgeArticleSchema), update);
knowledgeArticleRouter.delete("/:id", manageRoles, validateParams(knowledgeArticleParamsSchema), remove);
