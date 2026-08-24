import { apiClient } from "@/services/api-client";
import type { LoginValues, RegistrationValues } from "./auth.schemas";
import type { ApiEnvelope, AuthResponse, AuthUser } from "./auth.types";

export async function loginRequest(values: LoginValues) {
  const response = await apiClient.post<ApiEnvelope<AuthResponse>>("/auth/login", values);
  return response.data.data;
}

export async function registerRequest(values: RegistrationValues) {
  const { confirmPassword: _confirmPassword, ...registration } = values;
  void _confirmPassword;
  const body = { ...registration, phone: registration.phone || undefined };
  const response = await apiClient.post<ApiEnvelope<AuthResponse>>("/auth/register", body);
  return response.data.data;
}

export async function getCurrentUserRequest() {
  const response = await apiClient.get<ApiEnvelope<{ user: AuthUser }>>("/auth/me");
  return response.data.data.user;
}
