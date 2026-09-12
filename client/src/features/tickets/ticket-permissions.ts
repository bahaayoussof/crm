import type { AuthUser, Role } from "@/features/auth/auth.types";
import type { TicketDetail } from "./ticket.types";

export function canManageTicketDefinition(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canOperateAssignedTicket(ticket: TicketDetail, user: AuthUser) {
  return canManageTicketDefinition(user.role) || (user.role === "AGENT" && ticket.assignedAgent?.id === user.id);
}

/** MS-03 / MS-04 invariant: CLOSED = viewable + immutable. A CLOSED ticket stays
 * fully readable but takes NO mutation — conversation (public reply, internal
 * note, attachments) or metadata/workflow/routing. The backend enforces this
 * with `409 TICKET_CLOSED`; these helpers gate the UI so the user is never
 * offered an action that always fails. Reads (detail, history, SLA, metadata,
 * attachment list/download) are never gated. */
export function isTicketMutable(ticket: TicketDetail) {
  return ticket.status !== "CLOSED";
}

export function canMutateTicketConversation(ticket: TicketDetail, user: AuthUser) {
  return isTicketMutable(ticket) && canOperateAssignedTicket(ticket, user);
}

/** Gates the sidebar status/priority/category/assignee controls and the edit
 * form. CLOSED → off (MS-04). */
export function canMutateTicketWorkflow(ticket: TicketDetail, user: AuthUser) {
  return isTicketMutable(ticket) && canOperateAssignedTicket(ticket, user);
}

/** Role-based management capability, narrowed to a still-mutable ticket (MS-04).
 * Drives the Edit link, the metadata selects, and the AI "Apply category". */
export function canManageTicketNow(ticket: TicketDetail, user: AuthUser) {
  return isTicketMutable(ticket) && canManageTicketDefinition(user.role);
}

export function canCloseTicket(ticket: TicketDetail, user: AuthUser) {
  return ticket.status === "RESOLVED" && canOperateAssignedTicket(ticket, user);
}

/** An agent may claim an unassigned ticket for themselves. Backend is the
 * authority — this only decides whether to render the "Assign to me" control. */
export function canSelfAssignTicket(ticket: TicketDetail, user: AuthUser) {
  return isTicketMutable(ticket) && user.role === "AGENT" && !ticket.assignedAgent;
}
