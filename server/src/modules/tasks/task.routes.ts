import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, getOne, list, remove, update } from "./task.controller.js";
import { createTaskSchema, listTasksQuerySchema, taskIdParamSchema, updateTaskSchema } from "./task.schema.js";

export const taskRouter = Router();

// All task routes: internal roles only — CUSTOMER receives 403
taskRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));

taskRouter.get("/", validateQuery(listTasksQuerySchema), list);
taskRouter.post("/", validateBody(createTaskSchema), create);
taskRouter.get("/:id", validateParams(taskIdParamSchema), getOne);
taskRouter.patch("/:id", validateParams(taskIdParamSchema), validateBody(updateTaskSchema), update);
taskRouter.delete("/:id", validateParams(taskIdParamSchema), remove);
