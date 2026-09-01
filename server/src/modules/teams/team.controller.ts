import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";
import type { CreateTeamInput, TeamListQuery, TeamParams, UpdateTeamInput } from "./team.schema.js";
import { createTeam, deleteTeam, listActiveTeams, listTeams, updateTeam } from "./team.service.js";

function actorId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}
const params = (response: Response) => response.locals.validatedParams as TeamParams;

export const teamLookup: RequestHandler = async (request, response) => {
  const departmentId = typeof request.query.departmentId === "string" ? request.query.departmentId : undefined;
  response.status(200).json({ data: await listActiveTeams(departmentId) });
};

export const teamList: RequestHandler = async (_request, response) =>
  response.status(200).json(await listTeams(response.locals.validatedQuery as TeamListQuery));

export const teamCreate: RequestHandler<unknown, unknown, CreateTeamInput> = async (request, response) =>
  response.status(201).json({ data: await createTeam(request.body, actorId(request), getAuditRequestContext(request)) });

export const teamUpdate: RequestHandler<unknown, unknown, UpdateTeamInput> = async (request, response) =>
  response
    .status(200)
    .json({ data: await updateTeam(params(response).id, request.body, actorId(request), getAuditRequestContext(request)) });

export const teamRemove: RequestHandler = async (request, response) => {
  await deleteTeam(params(response).id, actorId(request), getAuditRequestContext(request));
  response.status(204).send();
};
