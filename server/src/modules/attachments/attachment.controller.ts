import type { Response } from "express";
import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  AttachmentDownloadParams,
  CustomerAttachmentParams,
  MessageAttachmentParams,
  TicketAttachmentParams,
} from "./attachment.schema.js";
import * as service from "./attachment.service.js";
import { contentDispositionAttachment } from "./file-name.js";
import { parseSingleUpload } from "./parse-upload.js";

function actor(request: Express.Request): service.Actor {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const params = <T>(response: Response): T => response.locals.validatedParams as T;

/** Stream attachment bytes with strict, non-sniffable download headers. */
export function sendAttachment(response: Response, file: service.DownloadedAttachment): void {
  response.setHeader("Content-Type", file.mimeType);
  response.setHeader("Content-Disposition", contentDispositionAttachment(file.fileName));
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Content-Length", String(file.body.length));
  response.status(200).end(file.body);
}

export const listTicketAttachments: RequestHandler = async (request, response) => {
  response.status(200).json(
    await service.listTicketAttachments(params<TicketAttachmentParams>(response).ticketId, actor(request)),
  );
};

export const uploadTicketAttachment: RequestHandler = async (request, response) => {
  const context = await service.authorizeTicketUpload(params<TicketAttachmentParams>(response).ticketId, actor(request));
  const upload = await parseSingleUpload(request);
  const row = await service.persistUpload(context, upload);
  response.status(201).json({ data: service.projectInternal(row) });
};

export const listMessageAttachments: RequestHandler = async (request, response) => {
  const { ticketId, messageId } = params<MessageAttachmentParams>(response);
  response.status(200).json(await service.listMessageAttachments(ticketId, messageId, actor(request)));
};

export const uploadMessageAttachment: RequestHandler = async (request, response) => {
  const { ticketId, messageId } = params<MessageAttachmentParams>(response);
  const context = await service.authorizeMessageUpload(ticketId, messageId, actor(request));
  const upload = await parseSingleUpload(request);
  const row = await service.persistUpload(context, upload);
  response.status(201).json({ data: service.projectInternal(row) });
};

export const listCustomerAttachments: RequestHandler = async (_request, response) => {
  response.status(200).json(await service.listCustomerAttachments(params<CustomerAttachmentParams>(response).customerId));
};

export const uploadCustomerAttachment: RequestHandler = async (request, response) => {
  const context = await service.authorizeCustomerUpload(params<CustomerAttachmentParams>(response).customerId);
  const upload = await parseSingleUpload(request);
  const row = await service.persistUpload(context, upload);
  response.status(201).json({ data: service.projectInternal(row) });
};

export const downloadAttachment: RequestHandler = async (request, response) => {
  const resolved = await service.resolveInternalDownload(
    params<AttachmentDownloadParams>(response).attachmentId,
    actor(request),
  );
  const file = await service.readAttachmentBytes(resolved);
  sendAttachment(response, file);
};
