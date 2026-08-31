import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";
import type {
  BranchListQuery,
  BranchParams,
  CreateBranchInput,
  UpdateBranchInput,
} from "./branch.schema.js";
import {
  createBranch,
  deleteBranch,
  listActiveBranches,
  listBranches,
  updateBranch,
} from "./branch.service.js";

function actorId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}
const params = (response: Response) => response.locals.validatedParams as BranchParams;

export const branchLookup: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await listActiveBranches() });

export const branchList: RequestHandler = async (_request, response) =>
  response.status(200).json(await listBranches(response.locals.validatedQuery as BranchListQuery));

export const branchCreate: RequestHandler<unknown, unknown, CreateBranchInput> = async (request, response) =>
  response.status(201).json({ data: await createBranch(request.body, actorId(request), getAuditRequestContext(request)) });

export const branchUpdate: RequestHandler<unknown, unknown, UpdateBranchInput> = async (request, response) =>
  response
    .status(200)
    .json({ data: await updateBranch(params(response).id, request.body, actorId(request), getAuditRequestContext(request)) });

export const branchRemove: RequestHandler = async (request, response) => {
  await deleteBranch(params(response).id, actorId(request), getAuditRequestContext(request));
  response.status(204).send();
};
