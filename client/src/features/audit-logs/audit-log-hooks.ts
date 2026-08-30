import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "./audit-log-api";
import type { AuditLogFilters } from "./audit-log.types";
export const useAuditLogs = (filters: AuditLogFilters) => useQuery({ queryKey: ["audit-logs", filters], queryFn: () => getAuditLogs(filters) });
