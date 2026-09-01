import { apiClient } from "@/services/api-client";
import type { ManagerAgentDetail, ManagerOverview, ManagerTeam, ManagerTeamQueryParams } from "./manager.types";

export async function getManagerOverview() {
  return (await apiClient.get<{ data: ManagerOverview }>("/manager/overview")).data.data;
}

export async function getManagerTeam(query: ManagerTeamQueryParams = {}) {
  const params: Record<string, string | number> = {};
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.page) params.page = query.page;
  if (query.limit) params.limit = query.limit;
  if (query.sortBy) params.sortBy = query.sortBy;
  if (query.sortOrder) params.sortOrder = query.sortOrder;
  return (await apiClient.get<{ data: ManagerTeam }>("/manager/team", { params })).data.data;
}

export async function getManagerAgentDetail(agentId: string) {
  return (await apiClient.get<{ data: ManagerAgentDetail }>(`/manager/team/${agentId}`)).data.data;
}
