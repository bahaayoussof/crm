import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { getDashboardOverview } from "./dashboard.service.js";

export const overview: RequestHandler = async (request, response) => {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  response.status(200).json({ data: await getDashboardOverview({ userId: request.auth.userId, role: request.auth.role }) });
};
