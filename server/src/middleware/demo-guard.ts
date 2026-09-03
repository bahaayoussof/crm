import type { Prisma } from "@prisma/client";
import { isDemoMode, isDemoProtectedEmail } from "../config/demo.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../shared/errors/app-error.js";

/**
 * Backend enforcement of public-demo protection. All helpers are inert unless
 * `DEMO_MODE=true`, so production account management and admin config are never
 * affected. The structured code is always `DEMO_PROTECTED_RESOURCE` (HTTP 403),
 * carried by the project's normal `AppError` so the error handler renders it in
 * the standard `{ error: { code, message } }` envelope.
 *
 * Scope (deliberately narrow — the demo must still feel interactive):
 *  - the four shared demo accounts cannot have their email / password / name /
 *    role changed, be deactivated, or be deleted;
 *  - departments, teams and categories cannot be deleted (a delete would break
 *    seeded ticket/routing scenarios for everyone).
 * Everything else — creating and editing tickets, messages, notes, tasks,
 * customers, status / priority / assignment changes — stays allowed.
 */

const DEMO_PROTECTED = "DEMO_PROTECTED_RESOURCE";

export function demoProtectedError(message: string): AppError {
  return new AppError(403, DEMO_PROTECTED, message);
}

/** Throw if demo mode is on and `email` is one of the shared demo identities. */
export function assertNotDemoProtectedEmail(
  email: string | null | undefined,
  message = "This account is protected in the public demo environment and cannot be modified.",
): void {
  if (isDemoProtectedEmail(email)) throw demoProtectedError(message);
}

/** Resolve a user id to its email first, then apply {@link assertNotDemoProtectedEmail}. */
export async function assertNotDemoProtectedUserId(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  message?: string,
): Promise<void> {
  if (!isDemoMode()) return;
  const user = await client.user.findUnique({ where: { id: userId }, select: { email: true } });
  assertNotDemoProtectedEmail(user?.email, message);
}

/**
 * Throw if demo mode is on. Use on the delete path of shared structural entities
 * (department / team / category) whose removal would break seeded scenarios for
 * every visitor.
 */
export function assertDeletionAllowedInDemo(entity: string): void {
  if (isDemoMode()) {
    throw demoProtectedError(
      `${entity} deletion is disabled in the public demo environment.`,
    );
  }
}
