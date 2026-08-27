import { Router } from "express";
import { requireCronSecret } from "./sla-automation.auth.js";
import { monitor } from "./sla-automation.controller.js";

export const slaAutomationRouter = Router();

slaAutomationRouter.get("/", requireCronSecret, monitor);
