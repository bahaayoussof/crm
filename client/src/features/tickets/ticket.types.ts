export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | "ESCALATED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketChannel = "WEB" | "EMAIL" | "WHATSAPP" | "SMS" | "LIVE_CHAT";
// Channels an internal user may pick when proactively creating a ticket. Single
// source of truth on the client — the form and its schema both derive from this.
export const TICKET_CREATE_CHANNELS = ["WEB", "EMAIL", "WHATSAPP", "SMS"] as const;
export type TicketCreateChannel = (typeof TICKET_CREATE_CHANNELS)[number];
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
// Delivery-failure reasons are shared across every provider-backed channel
// (WhatsApp, Email, SMS). A staff reply is persisted locally first; the outbound
// provider is attempted after commit, so `status: "FAILED"` means the reply was
// saved but not delivered externally — never that the reply was lost.
export type OutboundDeliveryReason =
  | "INTEGRATION_NOT_CONFIGURED"
  | "NO_RECIPIENT_PHONE"
  | "NO_RECIPIENT_EMAIL"
  | "RECIPIENT_INVALID"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNREACHABLE";
/** @deprecated use OutboundDeliveryReason — kept as an alias for existing imports. */
export type WhatsappDeliveryReason = OutboundDeliveryReason;
export type MessageDelivery = {
  channel: "WHATSAPP" | "EMAIL" | "SMS";
  status: "SENT" | "FAILED";
  externalId?: string;
  reason?: OutboundDeliveryReason;
};
export type TicketMessageResult = TicketConversationItem & { delivery?: MessageDelivery };
export interface TicketDetail extends TicketListItem {
  description: string; resolvedAt: string | null; closedAt: string | null;
  slaState: SlaState; effectiveSlaDueAt: string | null; effectiveSlaTarget: SlaTarget;
  watcherCount: number; viewerIsWatching: boolean;
  customer: TicketPerson & { phone: string | null; createdAt: string };
  department: { id: string; name: string } | null; branch: { id: string; name: string } | null;
  team: { id: string; name: string; departmentId: string } | null;
  history: TicketHistory[]; conversation: TicketConversationItem[];
}
export type TicketListScope = "mine" | "unassigned";
export interface TicketFilters { search: string; page: number; limit: number; scope?: TicketListScope; status?: TicketStatus; priority?: TicketPriority; categoryId?: string; assignedAgentId?: string; customerId?: string; departmentId?: string; branchId?: string }
export interface TicketListResponse { data: TicketListItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export type AgentOption = TicketPerson & { teamId: string | null };
export interface TicketCreateValues { customerId: string; subject: string; description: string; priority: TicketPriority; channel: TicketCreateChannel; categoryId?: string | null; assignedAgentId?: string | null; departmentId?: string | null; teamId?: string | null }
// `channel` is fixed at creation and never updated (it drives provider routing).
export type TicketUpdateValues = Partial<Omit<TicketCreateValues, "customerId" | "channel"> & { status: TicketStatus }>;
export interface TicketConversationValues { body: string }
