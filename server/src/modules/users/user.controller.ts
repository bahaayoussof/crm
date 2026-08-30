import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateUserInput, UpdateUserInput, UserListQuery, UserParams } from "./user.schema.js";
import { createUser, getUser, listUsers, updateUser } from "./user.service.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const params = (response: Response) => response.locals.validatedParams as UserParams;

export const list: RequestHandler = async (_request, response) =>
  response.status(200).json(await listUsers(response.locals.validatedQuery as UserListQuery));

export const detail: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getUser(params(response).id) });

export const create: RequestHandler<unknown, unknown, CreateUserInput> = async (request, response) =>
  response.status(201).json({ data: await createUser(request.body, actor(request).userId, getAuditRequestContext(request)) });

export const update: RequestHandler<unknown, unknown, UpdateUserInput> = async (request, response) =>
  response.status(200).json({ data: await updateUser(params(response).id, request.body, actor(request), getAuditRequestContext(request)) });
