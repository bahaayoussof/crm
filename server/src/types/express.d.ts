import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        /** JWT `iat` in seconds. Used by requireFreshToken to reject tokens
         *  issued before the account's passwordChangedAt. */
        issuedAt: number;
      };
    }
  }
}

export {};
