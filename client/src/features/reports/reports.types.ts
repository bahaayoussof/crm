import type { TicketPriority, TicketStatus } from "../tickets/ticket.types";

export interface ReportsRangeParams {
  from?: string;
  to?: string;
}

interface RangeMeta {
  range: { from: string; to: string };
  timezone: "UTC";
  generatedAt: string;
}

export interface VolumePoint {
  date: string;
  created: number;
  resolved: number;
}

export interface StatusCount {
  status: TicketStatus;
  count: number;
}

export interface RatingCount {
  rating: number;
  count: number;
}

export interface ReportsOverview extends RangeMeta {
  kpis: {
    createdTickets: number;
    resolvedTickets: number;
    slaCompliancePct: number | null;
    averageFirstResponseMinutes: number | null;
    satisfaction: { averageRating: number | null; responseCount: number };
  };
  ticketVolume: VolumePoint[];
  statusDistribution: StatusCount[];
  satisfaction: { averageRating: number | null; responseCount: number; distribution: RatingCount[] };
}

export interface TicketReports extends RangeMeta {
  totals: { created: number; resolved: number; open: number };
  volume: VolumePoint[];
  byStatus: StatusCount[];
  byPriority: Array<{ priority: TicketPriority; created: number; resolved: number }>;
  byCategory: Array<{ categoryId: string | null; categoryName: string | null; created: number }>;
}

export interface AgentReportRow {
  agentId: string;
  agentName: string;
  assigned: number;
  resolved: number;
  open: number;
  slaMet: number;
  slaBreached: number;
  slaMetPct: number | null;
  averageFirstResponseMinutes: number | null;
}

export interface AgentReports extends RangeMeta {
  agents: AgentReportRow[];
}

interface SlaTally {
  met: number;
  breached: number;
  pending: number;
  total: number;
  compliancePct: number | null;
}

export interface SlaReports extends RangeMeta {
  firstResponse: SlaTally;
  resolution: SlaTally;
  byPriority: Array<{
    priority: TicketPriority;
    firstResponseMet: number;
    firstResponseBreached: number;
    resolutionMet: number;
    resolutionBreached: number;
    compliancePct: number | null;
  }>;
  averageFirstResponseMinutes: number | null;
  averageResolutionMinutes: number | null;
}
