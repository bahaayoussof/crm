import type { RequestHandler } from "express";
import type { AuditLogQuery } from "./audit-log.schema.js";
import { listAuditLogs } from "./audit-log.service.js";
export const list: RequestHandler = async (_request, response) => response.status(200).json(await listAuditLogs(response.locals.validatedQuery as AuditLogQuery));
