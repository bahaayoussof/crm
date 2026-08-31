import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { streamRealtimeEvents } from "./realtime.controller.js";

export const realtimeRouter = Router();

// Internal roles only for the first implementation. CUSTOMER (portal) realtime is
// a documented follow-up — see docs/22-realtime-events.md.
realtimeRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));

realtimeRouter.get("/events", streamRealtimeEvents);
