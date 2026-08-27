import { useQuery } from "@tanstack/react-query";
import { getAgentReports, getReportsOverview, getSlaReports, getTicketReports } from "./reports-api";
import type { ReportsRangeParams } from "./reports.types";

export const reportsKeys = {
  all: ["reports"] as const,
  overview: (range: ReportsRangeParams) => [...reportsKeys.all, "overview", range] as const,
  tickets: (range: ReportsRangeParams) => [...reportsKeys.all, "tickets", range] as const,
  agents: (range: ReportsRangeParams) => [...reportsKeys.all, "agents", range] as const,
  sla: (range: ReportsRangeParams) => [...reportsKeys.all, "sla", range] as const,
};

const options = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

export function useReportsOverview(range: ReportsRangeParams) {
  return useQuery({ queryKey: reportsKeys.overview(range), queryFn: () => getReportsOverview(range), ...options });
}

export function useTicketReports(range: ReportsRangeParams) {
  return useQuery({ queryKey: reportsKeys.tickets(range), queryFn: () => getTicketReports(range), ...options });
}

export function useAgentReports(range: ReportsRangeParams) {
  return useQuery({ queryKey: reportsKeys.agents(range), queryFn: () => getAgentReports(range), ...options });
}

export function useSlaReports(range: ReportsRangeParams) {
  return useQuery({ queryKey: reportsKeys.sla(range), queryFn: () => getSlaReports(range), ...options });
}
