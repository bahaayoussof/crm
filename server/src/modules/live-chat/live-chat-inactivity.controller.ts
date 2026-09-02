import type { RequestHandler } from "express";
import { runLiveChatInactivitySweep } from "./live-chat-inactivity.service.js";

/** `GET /api/internal/live-chat-inactivity` — cron-only inactivity auto-resolve sweep. */
export const sweep: RequestHandler = async (_request, response) => {
  response.json({ data: await runLiveChatInactivitySweep() });
};
