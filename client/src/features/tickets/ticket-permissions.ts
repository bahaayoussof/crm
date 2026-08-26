import type { AuthUser, Role } from "@/features/auth/auth.types";
import type { TicketDetail } from "./ticket.types";

export function canManageTicketDefinition(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

export function canOperateAssignedTicket(ticket: TicketDetail, user: AuthUser) {
  return canManageTicketDefinition(user.role) || (user.role === "AGENT" && ticket.assignedAgent?.id === user.id);
}

export function canCloseTicket(ticket: TicketDetail, user: AuthUser) {
  return ticket.status === "RESOLVED" && canOperateAssignedTicket(ticket, user);
}
