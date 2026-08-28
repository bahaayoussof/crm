export type TicketStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | "ESCALATED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketChannel = "WEB" | "EMAIL" | "WHATSAPP" | "SMS" | "LIVE_CHAT";
export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED";
export type SlaTarget = "FIRST_RESPONSE" | "RESOLUTION" | null;
export interface TicketPerson { id: string; name: string; email: string }
export interface TicketCategory { id: string; name: string; description?: string | null }
export interface TicketListItem {
  id: string; subject: string; status: TicketStatus; priority: TicketPriority; channel: TicketChannel;
  firstResponseDueAt: string | null; firstRespondedAt: string | null; resolutionDueAt: string | null;
  createdAt: string; updatedAt: string; customer: TicketPerson; assignedAgent: TicketPerson | null; category: TicketCategory | null;
}
export interface TicketHistory { id: string; action: string; oldValue: string | null; newValue: string | null; createdAt: string; actor: { id: string; name: string; role: string } | null }
export type TicketConversationKind = "PUBLIC_MESSAGE" | "INTERNAL_NOTE";
export interface TicketConversationItem { id: string; kind: TicketConversationKind; body: string; createdAt: string; author: { id: string; name: string; role: string } }
export type WhatsappDeliveryReason = "INTEGRATION_NOT_CONFIGURED" | "NO_RECIPIENT_PHONE" | "PROVIDER_REJECTED" | "PROVIDER_UNREACHABLE";
export interface MessageDelivery { channel: "WHATSAPP"; status: "SENT" | "FAILED"; externalId?: string; reason?: WhatsappDeliveryReason }
export type TicketMessageResult = TicketConversationItem & { delivery?: MessageDelivery };
export interface TicketDetail extends TicketListItem {
  description: string; resolvedAt: string | null; closedAt: string | null;
  slaState: SlaState; effectiveSlaDueAt: string | null; effectiveSlaTarget: SlaTarget;
  customer: TicketPerson & { phone: string | null; createdAt: string };
  department: { id: string; name: string } | null; branch: { id: string; name: string } | null; history: TicketHistory[]; conversation: TicketConversationItem[];
}
export interface TicketFilters { search: string; page: number; limit: number; status?: TicketStatus; priority?: TicketPriority; categoryId?: string; assignedAgentId?: string; customerId?: string }
export interface TicketListResponse { data: TicketListItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export type AgentOption = TicketPerson;
export interface TicketCreateValues { customerId: string; subject: string; description: string; priority: TicketPriority; categoryId?: string | null; assignedAgentId?: string | null }
export type TicketUpdateValues = Partial<Omit<TicketCreateValues, "customerId"> & { status: TicketStatus }>;
export interface TicketConversationValues { body: string }
