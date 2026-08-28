import { Router } from "express";
import { requireCronSecret } from "../sla-automation/sla-automation.auth.js";
import { remind } from "./task-reminder.controller.js";

export const taskReminderRouter = Router();

// Cron-only: reuses the shared CRON_SECRET bearer check (same policy as SLA monitoring).
taskReminderRouter.get("/", requireCronSecret, remind);
