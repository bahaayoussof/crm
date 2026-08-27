import type { RequestHandler } from "express";
import { runSlaMonitor } from "./sla-automation.service.js";

export const monitor: RequestHandler = async (_request, response) => {
  response.json({ data: await runSlaMonitor() });
};
