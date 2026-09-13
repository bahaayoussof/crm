import type { RequestHandler } from "express";
import { runOutboundDeliveryRetrySweep } from "./outbound-delivery-retry.service.js";

/** `GET /api/internal/outbound-delivery-retry` — cron-only bounded outbound delivery retry sweep. */
export const sweep: RequestHandler = async (_request, response) => {
  response.json({ data: await runOutboundDeliveryRetrySweep() });
};
