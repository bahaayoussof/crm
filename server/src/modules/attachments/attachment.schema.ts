import { z } from "zod";
import { databaseIdSchema } from "../../shared/validation/common.schema.js";

export const ticketAttachmentParamsSchema = z.object({ ticketId: databaseIdSchema }).strict();
export const messageAttachmentParamsSchema = z
  .object({ ticketId: databaseIdSchema, messageId: databaseIdSchema })
  .strict();
export const customerAttachmentParamsSchema = z.object({ customerId: databaseIdSchema }).strict();
export const attachmentDownloadParamsSchema = z.object({ attachmentId: databaseIdSchema }).strict();

export type TicketAttachmentParams = z.infer<typeof ticketAttachmentParamsSchema>;
export type MessageAttachmentParams = z.infer<typeof messageAttachmentParamsSchema>;
export type CustomerAttachmentParams = z.infer<typeof customerAttachmentParamsSchema>;
export type AttachmentDownloadParams = z.infer<typeof attachmentDownloadParamsSchema>;
