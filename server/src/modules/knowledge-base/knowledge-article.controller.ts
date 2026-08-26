import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type {
  CreateKnowledgeArticleInput,
  KnowledgeArticleListQuery,
  KnowledgeArticleParams,
  PortalKnowledgeArticleListQuery,
  UpdateKnowledgeArticleInput,
} from "./knowledge-article.schema.js";
import {
  createKnowledgeArticle,
  deleteKnowledgeArticle,
  getKnowledgeArticle,
  getPublishedKnowledgeArticle,
  listKnowledgeArticles,
  listPublishedKnowledgeArticles,
  updateKnowledgeArticle,
} from "./knowledge-article.service.js";

function actor(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const params = (response: Response) => response.locals.validatedParams as KnowledgeArticleParams;

export const list: RequestHandler = async (request, response) =>
  response.status(200).json(await listKnowledgeArticles(response.locals.validatedQuery as KnowledgeArticleListQuery));

export const detail: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getKnowledgeArticle(params(response).id) });

export const create: RequestHandler<unknown, unknown, CreateKnowledgeArticleInput> = async (request, response) =>
  response.status(201).json({ data: await createKnowledgeArticle(request.body, actor(request)) });

export const update: RequestHandler<unknown, unknown, UpdateKnowledgeArticleInput> = async (request, response) =>
  response.status(200).json({ data: await updateKnowledgeArticle(params(response).id, request.body) });

export const remove: RequestHandler = async (_request, response) => {
  await deleteKnowledgeArticle(params(response).id);
  response.status(204).send();
};

export const portalList: RequestHandler = async (_request, response) =>
  response.status(200).json(await listPublishedKnowledgeArticles(response.locals.validatedQuery as PortalKnowledgeArticleListQuery));

export const portalDetail: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await getPublishedKnowledgeArticle(params(response).id) });
