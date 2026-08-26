import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { addNote, create, detail, list, notes, remove, tickets, update } from "./customer.controller.js";
import { createCustomerNoteSchema, createCustomerSchema, customerListQuerySchema, customerParamsSchema, customerTicketListQuerySchema, updateCustomerSchema } from "./customer.schema.js";
import { listCustomerAttachments, uploadCustomerAttachment } from "../attachments/attachment.controller.js";
import { customerAttachmentParamsSchema } from "../attachments/attachment.schema.js";

export const customerRouter = Router();
const customerReadRoles = [Role.ADMIN, Role.MANAGER, Role.AGENT];
const customerWriteRoles = [Role.ADMIN, Role.MANAGER];

customerRouter.use(requireAuth);
customerRouter.get("/", requireRole(...customerReadRoles), validateQuery(customerListQuerySchema), list);
customerRouter.post("/", requireRole(...customerWriteRoles), validateBody(createCustomerSchema), create);
customerRouter.get("/:id", requireRole(...customerReadRoles), validateParams(customerParamsSchema), detail);
customerRouter.get("/:id/tickets", requireRole(...customerReadRoles), validateParams(customerParamsSchema), validateQuery(customerTicketListQuerySchema), tickets);
customerRouter.patch("/:id", requireRole(...customerWriteRoles), validateParams(customerParamsSchema), validateBody(updateCustomerSchema), update);
customerRouter.delete("/:id", requireRole(...customerWriteRoles), validateParams(customerParamsSchema), remove);
customerRouter.get("/:id/notes", requireRole(...customerReadRoles), validateParams(customerParamsSchema), notes);
customerRouter.post("/:id/notes", requireRole(...customerWriteRoles), validateParams(customerParamsSchema), validateBody(createCustomerNoteSchema), addNote);

// feature/attachments — customer-profile attachments (read: all internal roles; upload: ADMIN/MANAGER only)
customerRouter.get("/:customerId/attachments", requireRole(...customerReadRoles), validateParams(customerAttachmentParamsSchema), listCustomerAttachments);
customerRouter.post("/:customerId/attachments", requireRole(...customerWriteRoles), validateParams(customerAttachmentParamsSchema), uploadCustomerAttachment);
