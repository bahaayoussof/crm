import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateParams } from "../../middleware/validate.js";
import { downloadAttachment, uploadStagedAttachment } from "./attachment.controller.js";
import { attachmentDownloadParamsSchema } from "./attachment.schema.js";

/** Internal authenticated download proxy: GET /api/attachments/:attachmentId/download */
export const attachmentRouter = Router();
attachmentRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
attachmentRouter.get("/:attachmentId/download", validateParams(attachmentDownloadParamsSchema), downloadAttachment);
// CONV-041/049 — staged (unbound) upload; the composer submits the id
// alongside the message/note POST, which binds it atomically.
attachmentRouter.post("/staged", uploadStagedAttachment);
