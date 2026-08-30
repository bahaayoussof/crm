import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { getAuditRequestContext } from "../audit-logs/audit-request-context.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.schema.js";
import { changePassword, getCurrentUser, login, registerCustomer } from "./auth.service.js";
import { requestPasswordReset, resetPassword } from "./password-reset.service.js";

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

  const user = await getCurrentUser(request.auth.userId, request.auth.issuedAt);
  response.status(200).json({ data: { user } });
};

export const forgotPassword: RequestHandler<unknown, unknown, ForgotPasswordInput> = async (request, response) => {
  await requestPasswordReset(request.body.email, getAuditRequestContext(request));
  response.status(200).json({
    data: {
      message: "If an account exists for this email, a password reset link has been sent.",
    },
  });
};

export const resetPasswordHandler: RequestHandler<unknown, unknown, ResetPasswordInput> = async (request, response) => {
  await resetPassword(request.body, getAuditRequestContext(request));
  response.status(200).json({ data: { ok: true } });
};

export const changePasswordHandler: RequestHandler<unknown, unknown, ChangePasswordInput> = async (request, response) => {
  if (!request.auth) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const result = await changePassword(request.auth.userId, request.body, getAuditRequestContext(request));
  response.status(200).json({ data: result });
};
