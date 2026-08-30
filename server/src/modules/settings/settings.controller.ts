import type { RequestHandler, Response } from "express";
import type { TicketPriority } from "@prisma/client";
import type { CategoryQuery, CreateCategory, UpdateCategory, UpsertSla } from "./settings.schema.js";
import { createCategory, listCategories, listSlaRules, updateCategory, upsertSlaRule } from "./settings.service.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";
import { AppError } from "../../shared/errors/app-error.js";
function actorId(request: Express.Request) { if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"); return request.auth.userId; }

export const categoryList: RequestHandler = async (_r, res) => res.json({ data: await listCategories(res.locals.validatedQuery as CategoryQuery) });
export const categoryCreate: RequestHandler<unknown, unknown, CreateCategory> = async (req, res) => res.status(201).json({ data: await createCategory(req.body, actorId(req), getAuditRequestContext(req)) });
export const categoryUpdate: RequestHandler<unknown, unknown, UpdateCategory> = async (req, res) => res.json({ data: await updateCategory((res.locals.validatedParams as { id: string }).id, req.body, actorId(req), getAuditRequestContext(req)) });
export const slaList: RequestHandler = async (_r, res) => res.json({ data: await listSlaRules() });
export const slaUpsert: RequestHandler<unknown, unknown, UpsertSla> = async (req, res: Response) => res.json({ data: await upsertSlaRule((res.locals.validatedParams as { priority: TicketPriority }).priority, req.body, actorId(req), getAuditRequestContext(req)) });
