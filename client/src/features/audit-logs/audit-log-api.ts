import { apiClient } from "@/services/api-client";
import type { AuditLogFilters, AuditLogList } from "./audit-log.types";
export async function getAuditLogs(filters: AuditLogFilters) { return (await apiClient.get<AuditLogList>("/audit-logs", { params: filters })).data; }
