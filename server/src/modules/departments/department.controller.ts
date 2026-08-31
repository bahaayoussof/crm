import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";
import type {
  CreateDepartmentInput,
  DepartmentListQuery,
  DepartmentParams,
  UpdateDepartmentInput,
} from "./department.schema.js";
import {
  createDepartment,
  deleteDepartment,
  listActiveDepartments,
  listDepartments,
  updateDepartment,
} from "./department.service.js";

function actorId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}
const params = (response: Response) => response.locals.validatedParams as DepartmentParams;

export const departmentLookup: RequestHandler = async (_request, response) =>
  response.status(200).json({ data: await listActiveDepartments() });

export const departmentList: RequestHandler = async (_request, response) =>
  response.status(200).json(await listDepartments(response.locals.validatedQuery as DepartmentListQuery));

export const departmentCreate: RequestHandler<unknown, unknown, CreateDepartmentInput> = async (request, response) =>
  response.status(201).json({ data: await createDepartment(request.body, actorId(request), getAuditRequestContext(request)) });

export const departmentUpdate: RequestHandler<unknown, unknown, UpdateDepartmentInput> = async (request, response) =>
  response
    .status(200)
    .json({ data: await updateDepartment(params(response).id, request.body, actorId(request), getAuditRequestContext(request)) });

export const departmentRemove: RequestHandler = async (request, response) => {
  await deleteDepartment(params(response).id, actorId(request), getAuditRequestContext(request));
  response.status(204).send();
};
