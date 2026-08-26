import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AttachmentDownloadParams } from "./attachment.schema.js";
import * as service from "./attachment.service.js";
import { sendAttachment } from "./attachment.controller.js";
import { parseSingleUpload } from "./parse-upload.js";

function userId(request: Express.Request): string {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}

const params = <T>(response: Response): T => response.locals.validatedParams as T;

export const listPortalTicketAttachments: RequestHandler = async (request, response) => {
  response.status(200).json(
    await service.listPortalTicketAttachments(params<{ id: string }>(response).id, userId(request)),
  );
};

export const uploadPortalTicketAttachment: RequestHandler = async (request, response) => {
  const context = await service.authorizePortalTicketUpload(params<{ id: string }>(response).id, userId(request));
  const upload = await parseSingleUpload(request);
  const row = await service.persistUpload(context, upload);
  response.status(201).json({ data: service.projectPortal(row) });
};

export const downloadPortalAttachment: RequestHandler = async (request, response) => {
  const resolved = await service.resolvePortalDownload(
    params<AttachmentDownloadParams>(response).attachmentId,
    userId(request),
  );
  const file = await service.readAttachmentBytes(resolved);
  sendAttachment(response, file);
};
