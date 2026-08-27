import { Role } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requireActiveUser } from "../../middleware/require-active-user.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import { create, detail, list, update } from "./user.controller.js";
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
  userParamsSchema,
} from "./user.schema.js";

export const userRouter = Router();
userRouter.use(requireAuth);

// Ticket-assignment lookup — kept open to every internal role. JWT-role gated
// (not DB-fresh); the result is already limited to active AGENT users.
userRouter.get("/agents", requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT), async (_request, response) => {
  const data = await prisma.user.findMany({
    where: { role: Role.AGENT, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
  response.status(200).json({ data });
});

// User administration — ADMIN only (docs/18 §15; MANAGER access not granted).
// `requireActiveUser` resolves the caller's current DB role/active state first so
// a stale JWT cannot keep ADMIN access after a demotion or deactivation.
const adminGuards = [requireActiveUser, requireRole(Role.ADMIN)];

userRouter.get("/", ...adminGuards, validateQuery(userListQuerySchema), list);
userRouter.post("/", ...adminGuards, validateBody(createUserSchema), create);
userRouter.get("/:id", ...adminGuards, validateParams(userParamsSchema), detail);
userRouter.patch("/:id", ...adminGuards, validateParams(userParamsSchema), validateBody(updateUserSchema), update);
