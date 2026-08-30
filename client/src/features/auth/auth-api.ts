import { apiClient } from "@/services/api-client";
import type {
  ChangePasswordValues,
  ForgotPasswordValues,
  LoginValues,
  RegistrationValues,
  ResetPasswordValues,
} from "./auth.schemas";
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

export async function forgotPasswordRequest(values: ForgotPasswordValues) {
  const response = await apiClient.post<ApiEnvelope<{ message: string }>>("/auth/forgot-password", values);
  return response.data.data;
}

export async function resetPasswordRequest(values: ResetPasswordValues & { token: string }) {
  const response = await apiClient.post<ApiEnvelope<{ ok: true }>>("/auth/reset-password", values);
  return response.data.data;
}

export async function changePasswordRequest(values: ChangePasswordValues) {
  const response = await apiClient.patch<ApiEnvelope<{ token: string }>>("/auth/change-password", values);
  return response.data.data;
}
