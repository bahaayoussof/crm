import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { CreateQuickReplyInput, QuickReplyListQuery, QuickReplyParams, UpdateQuickReplyInput } from "./quick-reply.schema.js";
import {
  createQuickReply,
  deleteQuickReply,
  getQuickReply,
  listQuickReplies,
  updateQuickReply,
} from "./quick-reply.service.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const params = (response: Response) => response.locals.validatedParams as QuickReplyParams;

export const list: RequestHandler = async (_request, response) =>
  response.status(200).json(await listQuickReplies(response.locals.validatedQuery as QuickReplyListQuery));

export const detail: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getQuickReply(params(response).id) });

export const create: RequestHandler<unknown, unknown, CreateQuickReplyInput> = async (request, response) =>
  response.status(201).json({ data: await createQuickReply(request.body, actor(request)) });

export const update: RequestHandler<unknown, unknown, UpdateQuickReplyInput> = async (request, response) =>
  response.status(200).json({ data: await updateQuickReply(params(response).id, request.body) });

export const remove: RequestHandler = async (_request, response) => {
  await deleteQuickReply(params(response).id);
  response.status(204).send();
};
