import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { ManagerAgentParams, ManagerTeamQuery } from "./manager.schema.js";
import { getManagerAgentDetail, getManagerOverview, getManagerTeam } from "./manager.service.js";

function actorOf(request: Parameters<RequestHandler>[0]) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const overview: RequestHandler = async (request, response) => {
  response.status(200).json({ data: await getManagerOverview(actorOf(request)) });
};

export const team: RequestHandler = async (request, response) => {
  const query = (response as Response).locals.validatedQuery as ManagerTeamQuery;
  response.status(200).json({ data: await getManagerTeam(actorOf(request), query) });
};

export const agentDetail: RequestHandler = async (request, response) => {
  const params = (response as Response).locals.validatedParams as ManagerAgentParams;
  const data = await getManagerAgentDetail(actorOf(request), params.agentId);
  if (!data) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found");
  response.status(200).json({ data });
};
