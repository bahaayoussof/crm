import { apiClient } from "@/services/api-client";
import type { AgentReports, ReportsOverview, ReportsRangeParams, SlaReports, TicketReports } from "./reports.types";

function rangeQuery(range: ReportsRangeParams) {
  const params: Record<string, string> = {};
  if (range.from) params.from = range.from;
  if (range.to) params.to = range.to;
  if (range.departmentId) params.departmentId = range.departmentId;
  if (range.branchId) params.branchId = range.branchId;
  return params;
}

export async function getReportsOverview(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: ReportsOverview }>("/reports/overview", { params: rangeQuery(range) })).data.data;
}

export async function getTicketReports(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: TicketReports }>("/reports/tickets", { params: rangeQuery(range) })).data.data;
}

export async function getAgentReports(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: AgentReports }>("/reports/agents", { params: rangeQuery(range) })).data.data;
}

export async function getSlaReports(range: ReportsRangeParams) {
  return (await apiClient.get<{ data: SlaReports }>("/reports/sla", { params: rangeQuery(range) })).data.data;
}
