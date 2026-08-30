import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validateBody } from "../../middleware/validate.js";
import {
  changePasswordHandler,
  forgotPassword,
  me,
  register,
  resetPasswordHandler,
  signIn,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.schema.js";

export const authRouter = Router();

const forgotPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  code: "RATE_LIMITED",
  message: "Too many password reset requests. Please try again later.",
  key: (request) => {
    const email = String((request.body as { email?: unknown } | undefined)?.email ?? "").trim().toLowerCase();
    return `forgot:${request.ip ?? "unknown"}:${email}`;
  },
});

const resetPasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  code: "RATE_LIMITED",
  message: "Too many attempts. Please try again later.",
  key: (request) => `reset:${request.ip ?? "unknown"}`,
});

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), signIn);
authRouter.post("/forgot-password", forgotPasswordRateLimit, validateBody(forgotPasswordSchema), forgotPassword);
authRouter.post("/reset-password", resetPasswordRateLimit, validateBody(resetPasswordSchema), resetPasswordHandler);
authRouter.patch("/change-password", requireAuth, validateBody(changePasswordSchema), changePasswordHandler);
authRouter.get("/me", requireAuth, me);
