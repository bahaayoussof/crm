import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { streamRealtimeEvents } from "./realtime.controller.js";

export const realtimeRouter = Router();

// Every authenticated role connects. CUSTOMER (portal) connections are scoped
// server-side by `canReceive` (own public ticket events only) — see
// docs/22-realtime-events.md. `requireRole` is kept explicit so a future role is
// not granted realtime by accident.
realtimeRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT, Role.CUSTOMER));

realtimeRouter.get("/events", streamRealtimeEvents);
