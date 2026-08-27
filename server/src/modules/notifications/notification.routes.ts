import { Role } from "@prisma/client";
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validate.js";
import { listNotifications, markAllRead, markRead, unreadCount } from "./notification.controller.js";
import { notificationQuerySchema } from "./notification.schema.js";

export const notificationRouter = Router();

// All notification routes: internal roles only — CUSTOMER receives 403
notificationRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));

// Static routes must be registered before /:id to avoid shadowing
notificationRouter.get("/unread-count", unreadCount);
notificationRouter.patch("/read-all", markAllRead);

notificationRouter.get("/", validateQuery(notificationQuerySchema), listNotifications);
notificationRouter.patch("/:id/read", markRead);
