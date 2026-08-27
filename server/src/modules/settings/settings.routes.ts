import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireActiveUser } from "../../middleware/require-active-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { categoryCreate, categoryList, categoryUpdate, slaList, slaUpsert } from "./settings.controller.js";
import { createSettingsCategorySchema, settingsCategoryQuerySchema, settingsIdSchema, slaPrioritySchema, updateSettingsCategorySchema, upsertSlaRuleSchema } from "./settings.schema.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireActiveUser, requireRole(Role.ADMIN));
settingsRouter.get("/categories", validateQuery(settingsCategoryQuerySchema), categoryList);
settingsRouter.post("/categories", validateBody(createSettingsCategorySchema), categoryCreate);
settingsRouter.patch("/categories/:id", validateParams(settingsIdSchema), validateBody(updateSettingsCategorySchema), categoryUpdate);
settingsRouter.get("/sla-rules", slaList);
settingsRouter.put("/sla-rules/:priority", validateParams(slaPrioritySchema), validateBody(upsertSlaRuleSchema), slaUpsert);
