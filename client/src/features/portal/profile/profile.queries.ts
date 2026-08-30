import { createProfileQueries } from "@/features/profile/create-profile-queries";
import { getPortalProfile, updatePortalProfile } from "./profile.api";

const queries = createProfileQueries({
  queryKey: ["portal", "profile"],
  getFn: getPortalProfile,
  updateFn: updatePortalProfile,
});

export const portalProfileKeys = queries.keys;
export const usePortalProfile = queries.useProfile;
export const useUpdatePortalProfile = queries.useUpdateProfile;
