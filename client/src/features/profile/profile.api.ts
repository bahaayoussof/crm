import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { SelfProfile, SelfProfileUpdate } from "./profile.types";

export const getSelfProfile = async () =>
  (await apiClient.get<ApiEnvelope<SelfProfile>>("/auth/profile")).data.data;

export const updateSelfProfile = async (body: SelfProfileUpdate) =>
  (await apiClient.patch<ApiEnvelope<SelfProfile>>("/auth/profile", body)).data.data;
