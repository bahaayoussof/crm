import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";
import { getCurrentUser, login, registerCustomer } from "./auth.service.js";

export const register: RequestHandler<unknown, unknown, RegisterInput> = async (request, response) => {
  const auth = await registerCustomer(request.body);
  response.status(201).json({ data: auth });
};

export const signIn: RequestHandler<unknown, unknown, LoginInput> = async (request, response) => {
  const auth = await login(request.body);
  response.status(200).json({ data: auth });
};

export const me: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const user = await getCurrentUser(request.auth.userId);
  response.status(200).json({ data: { user } });
};
