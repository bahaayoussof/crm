import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { addNote, create, detail, list, notes, remove, update } from "./customer.controller.js";
import { createCustomerNoteSchema, createCustomerSchema, customerListQuerySchema, customerParamsSchema, updateCustomerSchema } from "./customer.schema.js";

export const customerRouter = Router();
const internalRoles = [Role.ADMIN, Role.MANAGER, Role.AGENT];

customerRouter.use(requireAuth, requireRole(...internalRoles));
customerRouter.get("/", validateQuery(customerListQuerySchema), list);
customerRouter.post("/", validateBody(createCustomerSchema), create);
customerRouter.get("/:id", validateParams(customerParamsSchema), detail);
customerRouter.patch("/:id", validateParams(customerParamsSchema), validateBody(updateCustomerSchema), update);
customerRouter.delete("/:id", validateParams(customerParamsSchema), remove);
customerRouter.get("/:id/notes", validateParams(customerParamsSchema), notes);
customerRouter.post("/:id/notes", validateParams(customerParamsSchema), validateBody(createCustomerNoteSchema), addNote);
