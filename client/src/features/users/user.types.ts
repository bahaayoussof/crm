export type ManageableRole = "ADMIN" | "MANAGER" | "AGENT";

export interface User {
  id: string;
  name: string;
  email: string;
  role: ManageableRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserFilters {
  page: number;
  limit: number;
  search: string;
  role?: ManageableRole;
  status?: "active" | "inactive";
}

export interface UserListResponse {
  data: User[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// Partial safe-update payload — only the keys actually being changed are sent.
export type UserUpdatePayload = Partial<{
  name: string;
  email: string;
  role: ManageableRole;
  isActive: boolean;
}>;

export const MANAGEABLE_ROLES: ManageableRole[] = ["ADMIN", "MANAGER", "AGENT"];
