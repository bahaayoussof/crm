import { Role } from "@prisma/client";
import type { Request, RequestHandler, Response } from "express";
import { resolveActorTeamId } from "../../shared/team/team-scope.js";
import type { ReportsAgentsQuery, ReportsRange } from "./reports.schema.js";
import { getAgentReports, getReportsOverview, getSlaReports, getTicketReports } from "./reports.service.js";

const range = (response: Response) => response.locals.validatedQuery as ReportsRange;
const agentsQuery = (response: Response) => response.locals.validatedQuery as ReportsAgentsQuery;

/**
 * Injects the MANAGER's own team id into the validated query so every report is
 * team-scoped at the query layer (never client-side). ADMIN is untouched
 * (organization-wide). A MANAGER with no team gets a sentinel id that matches no
 * row — they see an empty report rather than everything.
 */
async function withTeamScope<T extends { teamId?: string | null }>(request: Request, query: T): Promise<T> {
  if (request.auth?.role !== Role.MANAGER) return query;
  const teamId = await resolveActorTeamId({ userId: request.auth.userId, role: request.auth.role });
  return { ...query, teamId: teamId ?? "__no_team__" };
}

export const overview: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await getReportsOverview(await withTeamScope(request, range(response))) });

export const tickets: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await getTicketReports(await withTeamScope(request, range(response))) });

export const agents: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await getAgentReports(await withTeamScope(request, agentsQuery(response))) });

export const sla: RequestHandler = async (request, response) =>
  response.status(200).json({ data: await getSlaReports(await withTeamScope(request, range(response))) });
