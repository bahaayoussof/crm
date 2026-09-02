import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import * as liveChat from "./live-chat.service.js";

function userId(request: Express.Request) {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return request.auth.userId;
}

/** `GET /api/portal/live-chat` — resumable live chat, or `{ data: null }`. */
export const get: RequestHandler = async (req, res) =>
  res.json({ data: await liveChat.getActiveLiveChat(userId(req)) });

/** `POST /api/portal/live-chat` — resume or start; always returns the chat. */
export const start: RequestHandler = async (req, res) =>
  res.status(201).json({ data: await liveChat.startLiveChat(userId(req)) });
