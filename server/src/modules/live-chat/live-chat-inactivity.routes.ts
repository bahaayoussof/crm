import { Router } from "express";
import { requireCronSecret } from "../sla-automation/sla-automation.auth.js";
import { sweep } from "./live-chat-inactivity.controller.js";

export const liveChatInactivityRouter = Router();

// Cron-only: reuses the shared CRON_SECRET bearer check (same policy as the SLA
// monitor and task reminders). No second cron-auth mechanism.
liveChatInactivityRouter.get("/", requireCronSecret, sweep);
