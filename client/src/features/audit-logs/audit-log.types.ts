export type AuditChange = { from?: string | number | boolean | null; to?: string | number | boolean | null };
export type AuditLog = { id: string; action: string; entityType: string; entityId: string | null; actor: { id: string; name: string; email: string } | null; changes: Record<string, AuditChange>; metadata: Record<string, string | number | boolean | null>; ipAddress: string | null; userAgent: string | null; createdAt: string };
export type AuditLogFilters = { page: number; limit: number; search?: string; actorId?: string; action?: string; entityType?: string; entityId?: string; from?: string; to?: string };
export type AuditLogList = { data: AuditLog[]; meta: { page: number; limit: number; total: number; totalPages: number } };
