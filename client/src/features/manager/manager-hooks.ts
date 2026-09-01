import { useQuery } from "@tanstack/react-query";
import { getManagerAgentDetail, getManagerOverview, getManagerTeam } from "./manager-api";
import type { ManagerTeamQueryParams } from "./manager.types";

export const managerKeys = {
  all: ["manager"] as const,
  overview: () => [...managerKeys.all, "overview"] as const,
  team: (query: ManagerTeamQueryParams) => [...managerKeys.all, "team", query] as const,
  agent: (agentId: string) => [...managerKeys.all, "agent", agentId] as const,
};

const options = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

export function useManagerOverview() {
  return useQuery({ queryKey: managerKeys.overview(), queryFn: getManagerOverview, ...options });
}

export function useManagerTeam(query: ManagerTeamQueryParams = {}) {
  return useQuery({
    queryKey: managerKeys.team(query),
    queryFn: () => getManagerTeam(query),
    placeholderData: (previous) => previous,
    ...options,
  });
}

export function useManagerAgentDetail(agentId: string | undefined) {
  return useQuery({
    queryKey: managerKeys.agent(agentId ?? ""),
    queryFn: () => getManagerAgentDetail(agentId as string),
    enabled: Boolean(agentId),
    ...options,
  });
}
