import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateParams, validateQuery } from "../../middleware/validate.js";
import { portalDetail, portalList } from "./knowledge-article.controller.js";
import { knowledgeArticleParamsSchema, portalKnowledgeArticleListQuerySchema } from "./knowledge-article.schema.js";

export const portalKnowledgeArticleRouter = Router();
portalKnowledgeArticleRouter.use(requireAuth, requireRole(Role.CUSTOMER));
portalKnowledgeArticleRouter.get("/", validateQuery(portalKnowledgeArticleListQuerySchema), portalList);
portalKnowledgeArticleRouter.get("/:id", validateParams(knowledgeArticleParamsSchema), portalDetail);
