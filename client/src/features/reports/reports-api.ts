import { apiClient } from "@/services/api-client";
import type {
  AgentReports,
  AgentReportsQueryParams,
  ReportsOverview,
  ReportsRangeParams,
  SlaReports,
  TicketReports,
} from "./reports.types";

function rangeQuery(range: ReportsRangeParams) {
  const params: Record<string, string> = {};
  if (range.from) params.from = range.from;
  if (range.to) params.to = range.to;
  if (range.departmentId) params.departmentId = range.departmentId;
  if (range.branchId) params.branchId = range.branchId;
  return params;
}

function agentQuery(query: AgentReportsQueryParams) {
  const params: Record<string, string | number> = rangeQuery(query);
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  if (query.sortBy) params.sortBy = query.sortBy;
  if (query.sortOrder) params.sortOrder = query.sortOrder;
  return params;
}

export async function getReportsOverview(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: ReportsOverview }>("/reports/overview", { params: rangeQuery(range) })).data.data;
}

export async function getTicketReports(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: TicketReports }>("/reports/tickets", { params: rangeQuery(range) })).data.data;
}

export async function getAgentReports(query: AgentReportsQueryParams = {}) {
  return (await apiClient.get<{ data: AgentReports }>("/reports/agents", { params: agentQuery(query) })).data.data;
}

export async function getSlaReports(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: SlaReports }>("/reports/sla", { params: rangeQuery(range) })).data.data;
}

