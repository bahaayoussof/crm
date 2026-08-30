import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { SelfProfile, SelfProfileUpdate } from "@/features/profile/profile.types";

export type PortalProfile = SelfProfile;
export type PortalProfileUpdate = SelfProfileUpdate;

export const getPortalProfile = async () =>
  (await apiClient.get<ApiEnvelope<SelfProfile>>("/portal/profile")).data.data;

export const updatePortalProfile = async (body: SelfProfileUpdate) =>
  (await apiClient.patch<ApiEnvelope<SelfProfile>>("/portal/profile", body)).data.data;
