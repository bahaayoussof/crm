import { Role } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const categoryRouter = Router();
categoryRouter.use(requireAuth, requireRole(Role.ADMIN, Role.MANAGER, Role.AGENT));
categoryRouter.get("/", async (_request, response) => {
  const data = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true } });
  response.status(200).json({ data });
});
