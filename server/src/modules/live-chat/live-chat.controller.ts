import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import * as liveChat from "./live-chat.service.js";
import type { LiveChatStartInput } from "./live-chat.schema.js";

function userId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}

/** `GET /api/portal/live-chat` — resumable live chat, or `{ data: null }`. */
export const get: RequestHandler = async (req, res) =>
  res.json({ data: await liveChat.getActiveLiveChat(userId(req)) });

/**
 * `GET /api/portal/live-chat/departments` — customer-safe list of Departments
 * the customer may route a new live chat to (active + has an active team).
 */
export const departments: RequestHandler = async (req, res) => {
  userId(req);
  res.json({ data: await liveChat.listLiveChatDepartments() });
};

/** `POST /api/portal/live-chat` — resume, or start a chat routed to `departmentId`. */
export const start: RequestHandler<unknown, unknown, LiveChatStartInput> = async (req, res) =>
  res.status(201).json({ data: await liveChat.startLiveChat(userId(req), req.body) });
