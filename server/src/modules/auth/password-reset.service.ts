import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../shared/errors/app-error.js";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../audit-logs/audit-log.constants.js";
import type { AuditRequestContext } from "../audit-logs/audit-request-context.js";
import { createAuditLog } from "../audit-logs/audit-log.service.js";
import { sendPasswordResetEmail } from "../email/password-reset.email.js";
import type { ResetPasswordInput } from "./auth.schema.js";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function appBaseUrl(): string {
  return (env.APP_URL ?? env.CLIENT_URL).replace(/\/$/, "");
}

/**
 * Always resolves to the same generic result regardless of whether the email
 * belongs to an account — prevents account enumeration. The raw token only ever
 * leaves the server inside the reset URL; the database stores its SHA-256 hash.
 */
export async function requestPasswordReset(
  email: string,
  requestContext?: AuditRequestContext,
): Promise<{ ok: true }> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });

  if (user) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.$transaction(async (tx) => {
      // At most one live reset link per account.
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    });

    const resetUrl = `${appBaseUrl()}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });

    await createAuditLog({
      actorId: user.id,
      action: AUDIT_ACTIONS.PASSWORD_RESET_REQUESTED,
      entityType: AUDIT_ENTITY_TYPES.USER,
      entityId: user.id,
      requestContext,
    });
  }

  return { ok: true };
}

export async function resetPassword(
  input: ResetPasswordInput,
  requestContext?: AuditRequestContext,
): Promise<{ ok: true }> {
  const tokenHash = hashToken(input.token);
  const now = new Date();

  const existing = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!existing || existing.usedAt) {
    throw new AppError(400, "TOKEN_INVALID", "This password reset link is invalid.");
  }
  if (existing.expiresAt.getTime() <= now.getTime()) {
    throw new AppError(400, "TOKEN_EXPIRED", "This password reset link has expired.");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.$transaction(async (tx) => {
    // Atomically claim the token: only one concurrent request can flip usedAt.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) {
      const current = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { usedAt: true, expiresAt: true },
      });
      if (current && !current.usedAt && current.expiresAt.getTime() <= now.getTime()) {
        throw new AppError(400, "TOKEN_EXPIRED", "This password reset link has expired.");
      }
      throw new AppError(400, "TOKEN_INVALID", "This password reset link is invalid.");
    }

    await tx.user.update({
      where: { id: existing.userId },
      data: { passwordHash, passwordChangedAt: now },
    });

    // Invalidate every other outstanding reset link for this user.
    await tx.passwordResetToken.deleteMany({
      where: { userId: existing.userId, usedAt: null },
    });
  });

  await createAuditLog({
    actorId: existing.userId,
    action: AUDIT_ACTIONS.PASSWORD_RESET_COMPLETED,
    entityType: AUDIT_ENTITY_TYPES.USER,
    entityId: existing.userId,
    requestContext,
  });

  return { ok: true };
}
