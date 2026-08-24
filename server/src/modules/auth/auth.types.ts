import type { Role } from "@prisma/client";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};
