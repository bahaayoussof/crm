import { Router } from "express";
import { requireCronSecret } from "../sla-automation/sla-automation.auth.js";
import { sweep } from "./outbound-delivery-retry.controller.js";

export const outboundDeliveryRetryRouter = Router();

// Cron-only: reuses the shared CRON_SECRET bearer check (same policy as the
// SLA monitor, task reminders, and the Live Chat inactivity sweep). No second
// cron-auth mechanism.
outboundDeliveryRetryRouter.get("/", requireCronSecret, sweep);
