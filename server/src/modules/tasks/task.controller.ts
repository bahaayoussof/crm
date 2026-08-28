import type { RequestHandler, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { deleteTask, createTask, getTask, listTasks, updateTask } from "./task.service.js";
import type { TaskActor } from "./task.service.js";
import type {
  CreateTaskInput,
  ListTasksQuery,
  TaskIdParam,
  UpdateTaskInput,
} from "./task.schema.js";

function actor(request: Express.Request): TaskActor {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return { userId: request.auth.userId, role: request.auth.role };
}

const params = (response: Response) => response.locals.validatedParams as TaskIdParam;

export const list: RequestHandler = async (request, response) => {
  const query = response.locals.validatedQuery as ListTasksQuery;
  response.json(await listTasks(actor(request), query));
};

export const getOne: RequestHandler = async (request, response) => {
  response.json({ data: await getTask(actor(request), params(response).id) });
};

export const create: RequestHandler<unknown, unknown, CreateTaskInput> = async (request, response) => {
  response.status(201).json({ data: await createTask(actor(request), request.body) });
};

export const update: RequestHandler<unknown, unknown, UpdateTaskInput> = async (request, response) => {
  response.json({ data: await updateTask(actor(request), params(response).id, request.body) });
};

export const remove: RequestHandler = async (request, response) => {
  await deleteTask(actor(request), params(response).id);
  response.status(204).send();
};
