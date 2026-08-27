import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { UserCreateFormValues } from "./user.schemas";
import type { User, UserFilters, UserListResponse, UserUpdatePayload } from "./user.types";

export async function getUsers(filters: UserFilters) {
  const response = await apiClient.get<UserListResponse>("/users", { params: filters });
  return response.data;
}

export async function getUser(id: string) {
  const response = await apiClient.get<ApiEnvelope<User>>(`/users/${id}`);
  return response.data.data;
}

export async function createUser(values: UserCreateFormValues) {
  const response = await apiClient.post<ApiEnvelope<User>>("/users", {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    role: values.role,
  });
  return response.data.data;
}

// Sends only the keys present in `payload` — fields that were not submitted are
// never included in the request body.
export async function updateUser(id: string, payload: UserUpdatePayload) {
  const body: UserUpdatePayload = {};
  if (payload.name !== undefined) body.name = payload.name.trim();
  if (payload.email !== undefined) body.email = payload.email.trim().toLowerCase();
  if (payload.role !== undefined) body.role = payload.role;
  if (payload.isActive !== undefined) body.isActive = payload.isActive;

  const response = await apiClient.patch<ApiEnvelope<User>>(`/users/${id}`, body);
  return response.data.data;
}
