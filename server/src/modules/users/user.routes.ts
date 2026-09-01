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
import { mentionable } from "../collaboration/collaboration.controller.js";
import { mentionableQuerySchema } from "../collaboration/collaboration.schema.js";
import { resolveActorTeamId } from "../../shared/team/team-scope.js";

export const userRouter = Router();
userRouter.use(requireAuth);

// Ticket-assignment lookup — kept open to every internal role. JWT-role gated
// (not DB-fresh); the result is already limited to active AGENT users.
//
// Team scope (feature/team-based-manager-scope):
//   - MANAGER → always their own team's agents (client `teamId` is ignored); a
//     manager with no team gets an empty list.
//   - ADMIN   → all active agents, or one team's when `?teamId=<cuid>` is given.
//   - AGENT   → unchanged (all active agents; used only for display, never assign).
userRouter.get("/agents", requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT), async (request, response) => {
  const auth = request.auth!;
  let teamId: string | null | undefined;
  if (auth.role === Role.MANAGER) {
    teamId = (await resolveActorTeamId({ userId: auth.userId, role: auth.role })) ?? "__no_team__";
  } else if (auth.role === Role.ADMIN) {
    const raw = typeof request.query.teamId === "string" ? request.query.teamId.trim() : "";
    teamId = raw.length > 0 ? raw : undefined;
  }
  const data = await prisma.user.findMany({
    where: { role: Role.AGENT, isActive: true, ...(teamId ? { teamId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, teamId: true },
  });
  response.status(200).json({ data });
});

// feature/team-collaboration — internal @mention autocomplete lookup. Open to
// every internal role (like `/agents`); returns active internal users only,
// never CUSTOMER. Registered before the dynamic `/:id` route below.
userRouter.get(
  "/mentionable",
  requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT),
  validateQuery(mentionableQuerySchema),
  mentionable,
);

// User administration — ADMIN only (docs/18 §15; MANAGER access not granted).
// `requireActiveUser` resolves the caller's current DB role/active state first so
// a stale JWT cannot keep ADMIN access after a demotion or deactivation.
const adminGuards = [requireActiveUser, requireRole(Role.ADMIN)];

userRouter.get("/", ...adminGuards, validateQuery(userListQuerySchema), list);
userRouter.post("/", ...adminGuards, validateBody(createUserSchema), create);
userRouter.get("/:id", ...adminGuards, validateParams(userParamsSchema), detail);
userRouter.patch("/:id", ...adminGuards, validateParams(userParamsSchema), validateBody(updateUserSchema), update);
