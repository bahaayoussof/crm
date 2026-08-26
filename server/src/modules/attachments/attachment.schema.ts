import { z } from "zod";

export const ticketAttachmentParamsSchema = z.object({ ticketId: z.string().trim().min(1) }).strict();
export const messageAttachmentParamsSchema = z
  .object({ ticketId: z.string().trim().min(1), messageId: z.string().trim().min(1) })
  .strict();
export const customerAttachmentParamsSchema = z.object({ customerId: z.string().trim().min(1) }).strict();
export const attachmentDownloadParamsSchema = z.object({ attachmentId: z.string().trim().min(1) }).strict();

export type TicketAttachmentParams = z.infer<typeof ticketAttachmentParamsSchema>;
export type MessageAttachmentParams = z.infer<typeof messageAttachmentParamsSchema>;
export type CustomerAttachmentParams = z.infer<typeof customerAttachmentParamsSchema>;
export type AttachmentDownloadParams = z.infer<typeof attachmentDownloadParamsSchema>;
