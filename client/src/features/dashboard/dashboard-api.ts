import { apiClient } from "@/services/api-client";
import type { DashboardOverview } from "./dashboard.types";

export async function getDashboardOverview() { return (await apiClient.get<{ data: DashboardOverview }>("/dashboard/overview")).data.data; }
