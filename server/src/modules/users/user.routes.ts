import { Role } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const userRouter = Router();
userRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
userRouter.get("/agents", async (_request, response) => {
  const data = await prisma.user.findMany({ where: { role: Role.AGENT }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } });
  response.status(200).json({ data });
});
