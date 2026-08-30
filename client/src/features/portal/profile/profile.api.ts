import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";

export interface PortalProfile {
  name: string;
  email: string;
  phone: string | null;
}

export interface PortalProfileUpdate {
  name: string;
  email: string;
  phone: string | null;
}

export const getPortalProfile = async () =>
  (await apiClient.get<ApiEnvelope<PortalProfile>>("/portal/profile")).data.data;

export const updatePortalProfile = async (body: PortalProfileUpdate) =>
  (await apiClient.patch<ApiEnvelope<PortalProfile>>("/portal/profile", body)).data.data;
