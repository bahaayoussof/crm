import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { me, register, signIn } from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), register);
authRouter.post("/login", validateBody(loginSchema), signIn);
authRouter.get("/me", requireAuth, me);
