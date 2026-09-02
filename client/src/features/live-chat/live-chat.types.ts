import type { PortalMessage, PortalTicketDetail, PortalTicketStatus } from "@/features/portal/portal.types";

/**
 * A live chat is a customer-safe view of a LIVE_CHAT Ticket. The backend returns
 * the exact same shape as the portal ticket detail (`GET /portal/tickets/:id`),
 * so the type is reused verbatim — no parallel model.
 */
export type LiveChat = PortalTicketDetail;
export type LiveChatMessage = PortalMessage;
export type LiveChatStatus = PortalTicketStatus;

/** `null` = the customer has no resumable live chat and can start one. */
export type LiveChatBootstrap = LiveChat | null;

/**
 * Customer-safe Department reference data for the "start a live chat" screen.
 * The server only ever returns routable Departments (active + has an active
 * team) and only these two fields — no branch / manager / team / counts.
 */
export type LiveChatDepartment = { id: string; name: string };

/** Terminal in the portal sense — read-only, start a fresh chat instead. */
export const TERMINAL_LIVE_CHAT_STATUSES: readonly LiveChatStatus[] = ["RESOLVED", "CLOSED"];

export function isTerminalLiveChat(status: LiveChatStatus): boolean {
  return TERMINAL_LIVE_CHAT_STATUSES.includes(status);
}
