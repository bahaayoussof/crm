import { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.nativeEnum(Role),
});

export function createAccessToken(user: { id: string; role: Role }) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "8h",
  });
}

export function verifyAccessToken(token: string) {
  try {
    const payload = tokenPayloadSchema.parse(jwt.verify(token, env.JWT_SECRET));
    return { userId: payload.sub, role: payload.role };
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
  }
}
