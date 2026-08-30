import type { Request } from "express";

export type AuditRequestContext = { ipAddress: string | null; userAgent: string | null };

export function getAuditRequestContext(request: Pick<Request, "header" | "ip">): AuditRequestContext {
  const forwarded = request.header("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const candidate = forwarded || request.ip || null;
  const ipAddress = candidate && candidate.length <= 64 ? candidate : null;
  const rawAgent = request.header("user-agent")?.trim();
  return { ipAddress, userAgent: rawAgent ? rawAgent.slice(0, 512) : null };
}
