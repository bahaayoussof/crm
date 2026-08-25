import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "./dashboard-api";

export const dashboardKeys = { all: ["dashboard"] as const, overview: () => [...dashboardKeys.all, "overview"] as const };
export function useDashboardOverview() { return useQuery({ queryKey: dashboardKeys.overview(), queryFn: getDashboardOverview, staleTime: 60_000, refetchOnWindowFocus: false }); }
