import type { TicketPriority, TicketStatus } from "@/features/tickets/ticket.types";

export type ManagerSlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "MET" | "NOT_CONFIGURED";

export interface ManagerTicketSummary {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: string;
  effectiveSlaDueAt: string | null;
  slaState: ManagerSlaState;
  customer: { id: string; name: string } | null;
  assignedAgent: { id: string; name: string } | null;
}

export interface NeedsAttentionItem {
  key: "slaBreached" | "slaAtRisk" | "escalated" | "unassignedUrgent";
  count: number;
  /** Query string to append to `/tickets` for the filtered queue. */
  ticketFilter: string;
}

export interface TeamWorkloadRow {
  agentId: string;
  agentName: string;
  openAssigned: number;
  inProgress: number;
  waitingCustomer: number;
  atRisk: number;
  resolvedToday: number;
}

export interface ManagerOverview {
  meta: { visibility: "ORGANIZATION_WIDE" | "TEAM"; teamName: string | null };
  needsAttention: NeedsAttentionItem[];
  kpis: {
    openTickets: number;
    unassigned: number;
    resolvedToday: number;
    slaCompliancePct: number | null;
    avgFirstResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
  };
  teamWorkload: TeamWorkloadRow[];
  priorityWork: ManagerTicketSummary[];
  generatedAt: string;
}

export type TeamSortBy =
  | "name"
  | "openAssigned"
  | "inProgress"
  | "waitingCustomer"
  | "resolved"
  | "slaCompliance"
  | "avgFirstResponse"
  | "avgResolution";

export interface ManagerTeamQueryParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: TeamSortBy;
  sortOrder?: "asc" | "desc";
}

export interface TeamMemberRow {
  agentId: string;
  agentName: string;
  openAssigned: number;
  inProgress: number;
  waitingCustomer: number;
  atRisk: number;
  resolved: number;
  slaCompliancePct: number | null;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export interface ManagerTeam {
  meta: { visibility: "ORGANIZATION_WIDE" | "TEAM"; teamName: string | null };
  data: TeamMemberRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  generatedAt: string;
}

export interface ManagerAgentDetail {
  meta: { visibility: "ORGANIZATION_WIDE" | "TEAM"; teamName: string | null };
  agent: { id: string; name: string; email: string };
  workload: { openAssigned: number; inProgress: number; waitingCustomer: number; escalated: number };
  slaRisk: { breached: number; atRisk: number };
  performance: {
    windowDays: number;
    avgFirstResponseMinutes: number | null;
    avgResolutionMinutes: number | null;
    resolvedCount: number;
    slaCompliancePct: number | null;
    csat: { averageRating: number | null; responseCount: number };
  };
  atRiskTickets: ManagerTicketSummary[];
  recentTickets: ManagerTicketSummary[];
  generatedAt: string;
}
