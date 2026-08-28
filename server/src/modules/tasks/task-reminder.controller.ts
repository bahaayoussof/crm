import type { RequestHandler } from "express";
import { runTaskReminders } from "./task-reminder.service.js";

export const remind: RequestHandler = async (_request, response) => {
  response.json({ data: await runTaskReminders() });
};
