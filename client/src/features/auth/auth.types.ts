export type Role = "ADMIN" | "MANAGER" | "AGENT" | "CUSTOMER";

export interface AuthUser {
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
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ApiEnvelope<T> {
  data: T;
}

