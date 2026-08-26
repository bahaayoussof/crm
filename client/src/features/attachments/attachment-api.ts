import { apiClient } from "@/services/api-client";
import type { AttachmentListResponse, InternalAttachment, PortalAttachment } from "./attachment.types";

// Upload: a dedicated request that clears the client's inherited JSON Content-Type
// so the browser sets `multipart/form-data` with its own boundary. Never sets a
// manual boundary. (Verified against axios 1.x: { "Content-Type": undefined }
// yields an unset header for a FormData body.)
async function uploadFile<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<{ data: T }>(url, form, { headers: { "Content-Type": undefined } });
  return response.data.data;
}

interface DownloadedBlob {
  blob: Blob;
  fileName: string;
}

function fileNameFromDisposition(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || fallback;
}

async function downloadBlob(url: string, fallbackName: string): Promise<DownloadedBlob> {
  const response = await apiClient.get<Blob>(url, { responseType: "blob" });
  const header = (response.headers as Record<string, string | undefined>)["content-disposition"];
  return { blob: response.data, fileName: fileNameFromDisposition(header, fallbackName) };
}

// --- Internal ---------------------------------------------------------------

export const getTicketAttachments = async (ticketId: string) =>
  (await apiClient.get<AttachmentListResponse<InternalAttachment>>(`/tickets/${ticketId}/attachments`)).data.data;

export const getCustomerAttachments = async (customerId: string) =>
  (await apiClient.get<AttachmentListResponse<InternalAttachment>>(`/customers/${customerId}/attachments`)).data.data;

export const uploadTicketAttachment = (ticketId: string, file: File) =>
  uploadFile<InternalAttachment>(`/tickets/${ticketId}/attachments`, file);

export const uploadMessageAttachment = (ticketId: string, messageId: string, file: File) =>
  uploadFile<InternalAttachment>(`/tickets/${ticketId}/messages/${messageId}/attachments`, file);

export const uploadCustomerAttachment = (customerId: string, file: File) =>
  uploadFile<InternalAttachment>(`/customers/${customerId}/attachments`, file);

export const downloadAttachment = (attachmentId: string, fallbackName: string) =>
  downloadBlob(`/attachments/${attachmentId}/download`, fallbackName);

// --- Customer Portal ------------------------------------------------------

export const getPortalTicketAttachments = async (ticketId: string) =>
  (await apiClient.get<AttachmentListResponse<PortalAttachment>>(`/portal/tickets/${ticketId}/attachments`)).data.data;

export const uploadPortalTicketAttachment = (ticketId: string, file: File) =>
  uploadFile<PortalAttachment>(`/portal/tickets/${ticketId}/attachments`, file);

export const downloadPortalAttachment = (attachmentId: string, fallbackName: string) =>
  downloadBlob(`/portal/attachments/${attachmentId}/download`, fallbackName);
