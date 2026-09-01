import type { TicketPriority, TicketStatus } from "../tickets/ticket.types";

export interface ReportsRangeParams {
  from?: string;
  to?: string;
  departmentId?: string;
  branchId?: string;
}

export type AgentSortBy =
  | "name"
  | "assigned"
  | "resolved"
  | "open"
  | "slaMetPercentage"
  | "avgFirstResponse";

export interface AgentReportsQueryParams extends ReportsRangeParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: AgentSortBy;
  sortOrder?: "asc" | "desc";
}

export interface RangeMeta {
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
  volume?: VolumePoint[];
  statusDistribution: StatusCount[];
  satisfaction: { averageRating: number | null; responseCount: number; distribution: RatingCount[] };
}


export interface TicketStatusReportItem {
  status: TicketStatus;
  count?: number;
  created: number;
  resolved: number;
}

export interface TicketCategoryReportItem {
  categoryId: string | null;
  categoryName: string | null;
  created: number;
  resolved: number;
}

export interface TicketChannelReportItem {
  channel: string;
  created: number;
  resolved: number;
}

export interface TicketReports extends RangeMeta {
  totals: { created: number; resolved: number; open: number };
  volume: VolumePoint[];
  byStatus: TicketStatusReportItem[];
  byPriority: Array<{ priority: TicketPriority; created: number; resolved: number }>;
  byCategory: TicketCategoryReportItem[];
  byChannel?: TicketChannelReportItem[];
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
  data?: AgentReportRow[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface SlaTally {
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

export interface BreakdownItem {
  key: string;
  label?: string;
  created: number;
  resolved: number;
  total: number;
  share: number;
}

