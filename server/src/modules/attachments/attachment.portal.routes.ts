import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateParams } from "../../middleware/validate.js";
import { downloadPortalAttachment } from "./attachment.portal.controller.js";
import { attachmentDownloadParamsSchema } from "./attachment.schema.js";

/** Customer Portal authenticated download proxy: GET /api/portal/attachments/:attachmentId/download */
export const portalAttachmentRouter = Router();
portalAttachmentRouter.use(requireAuth, requireRole(Role.CUSTOMER));
portalAttachmentRouter.get(
  "/:attachmentId/download",
  validateParams(attachmentDownloadParamsSchema),
  downloadPortalAttachment,
);
