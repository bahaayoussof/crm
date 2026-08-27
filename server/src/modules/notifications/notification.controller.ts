import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { NotificationQuery } from "./notification.schema.js";
import * as service from "./notification.service.js";

function userId(request: Express.Request): string {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}

export const listNotifications: RequestHandler = async (request, response) => {
  const query = response.locals.validatedQuery as NotificationQuery;
  response.json(await service.listNotifications(userId(request), query));
};

export const unreadCount: RequestHandler = async (request, response) => {
  response.json({ data: await service.getUnreadCount(userId(request)) });
};

export const markRead: RequestHandler = async (request, response) => {
  const id = request.params["id"] as string;
  response.json({ data: await service.markRead(userId(request), id) });
};

export const markAllRead: RequestHandler = async (request, response) => {
  response.json({ data: await service.markAllRead(userId(request)) });
};
