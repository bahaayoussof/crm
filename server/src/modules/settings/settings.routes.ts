import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireActiveUser } from "../../middleware/require-active-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { categoryCreate, categoryList, categoryUpdate, slaList, slaUpsert } from "./settings.controller.js";
import { createSettingsCategorySchema, settingsCategoryQuerySchema, settingsIdSchema, slaPrioritySchema, updateSettingsCategorySchema, upsertSlaRuleSchema } from "./settings.schema.js";
import {
  departmentCreate,
  departmentList,
  departmentRemove,
  departmentUpdate,
} from "../departments/department.controller.js";
import {
  createDepartmentSchema,
  departmentListQuerySchema,
  departmentParamsSchema,
  updateDepartmentSchema,
} from "../departments/department.schema.js";
import { branchCreate, branchList, branchRemove, branchUpdate } from "../branches/branch.controller.js";
import {
  branchListQuerySchema,
  branchParamsSchema,
  createBranchSchema,
  updateBranchSchema,
} from "../branches/branch.schema.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireActiveUser, requireRole(Role.ADMIN));
settingsRouter.get("/categories", validateQuery(settingsCategoryQuerySchema), categoryList);
settingsRouter.post("/categories", validateBody(createSettingsCategorySchema), categoryCreate);
settingsRouter.patch("/categories/:id", validateParams(settingsIdSchema), validateBody(updateSettingsCategorySchema), categoryUpdate);
settingsRouter.get("/sla-rules", slaList);
settingsRouter.put("/sla-rules/:priority", validateParams(slaPrioritySchema), validateBody(upsertSlaRuleSchema), slaUpsert);

// Organizational configuration — ADMIN-only, consistent with the rest of Settings.
settingsRouter.get("/departments", validateQuery(departmentListQuerySchema), departmentList);
settingsRouter.post("/departments", validateBody(createDepartmentSchema), departmentCreate);
settingsRouter.patch("/departments/:id", validateParams(departmentParamsSchema), validateBody(updateDepartmentSchema), departmentUpdate);
settingsRouter.delete("/departments/:id", validateParams(departmentParamsSchema), departmentRemove);

settingsRouter.get("/branches", validateQuery(branchListQuerySchema), branchList);
settingsRouter.post("/branches", validateBody(createBranchSchema), branchCreate);
settingsRouter.patch("/branches/:id", validateParams(branchParamsSchema), validateBody(updateBranchSchema), branchUpdate);
settingsRouter.delete("/branches/:id", validateParams(branchParamsSchema), branchRemove);
