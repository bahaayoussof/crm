import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerKeys } from "@/features/customers/customer-hooks";
import * as api from "./attachment-api";

export const attachmentKeys = {
  all: ["attachments"] as const,
  ticket: (ticketId: string) => ["attachments", "ticket", ticketId] as const,
  customer: (customerId: string) => ["attachments", "customer", customerId] as const,
  portalTicket: (ticketId: string) => ["attachments", "portal-ticket", ticketId] as const,
};

export const useTicketAttachments = (ticketId: string, enabled = true) =>
  useQuery({
    queryKey: attachmentKeys.ticket(ticketId),
    queryFn: () => api.getTicketAttachments(ticketId),
    enabled: enabled && Boolean(ticketId),
  });

export const useCustomerAttachments = (customerId: string, enabled = true) =>
  useQuery({
    queryKey: attachmentKeys.customer(customerId),
    queryFn: () => api.getCustomerAttachments(customerId),
    enabled: enabled && Boolean(customerId),
  });

export const usePortalTicketAttachments = (ticketId: string, enabled = true) =>
  useQuery({
    queryKey: attachmentKeys.portalTicket(ticketId),
    queryFn: () => api.getPortalTicketAttachments(ticketId),
    enabled: enabled && Boolean(ticketId),
  });

export function useUploadTicketAttachment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadTicketAttachment(ticketId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.ticket(ticketId) }),
  });
}

export function useUploadMessageAttachment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, file }: { messageId: string; file: File }) =>
      api.uploadMessageAttachment(ticketId, messageId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.ticket(ticketId) }),
  });
}

export function useUploadCustomerAttachment(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadCustomerAttachment(customerId, file),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: attachmentKeys.customer(customerId) }),
        qc.invalidateQueries({ queryKey: customerKeys.detail(customerId) }),
      ]);
    },
  });
}

export function useUploadPortalTicketAttachment(ticketId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadPortalTicketAttachment(ticketId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: attachmentKeys.portalTicket(ticketId) }),
  });
}
