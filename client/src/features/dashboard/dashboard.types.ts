import type { TicketPriority, TicketStatus } from "../tickets/ticket.types";

export type DashboardSlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED";
export type DashboardPrimaryQueueType = "NEEDS_ATTENTION" | "MY_ASSIGNED_TICKETS";
export interface DashboardTicket { id: string; subject: string; status: TicketStatus; priority: TicketPriority; updatedAt: string; effectiveSlaDueAt: string | null; slaState: DashboardSlaState; customer: { id: string; name: string }; assignedAgent: { id: string; name: string } | null }
export interface DashboardActivityPoint { date: string; opened: number; resolved: number }
export interface DashboardAgentPerformance {
  windowDays: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  resolvedCount: number;
  slaCompliancePct: number | null;
  csat: { averageRating: number | null; responseCount: number };
}
export interface DashboardOverview {
  metrics: { openTickets: number; assignedToMe: number; unassignedTickets: number; slaAtRisk: number; slaBreached: number; resolvedToday: number; waitingCustomer: number };
  statusDistribution: Array<{ status: TicketStatus; count: number }>;
  ticketActivity: DashboardActivityPoint[];
  primaryQueueType: DashboardPrimaryQueueType; primaryTickets: DashboardTicket[]; recentTickets: DashboardTicket[];
  /** Present only for AGENT — personal work-console performance summary. */
  agentPerformance?: DashboardAgentPerformance;
  generatedAt: string;
}
