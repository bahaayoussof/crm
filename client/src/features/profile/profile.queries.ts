import { createProfileQueries } from "./create-profile-queries";
import { getSelfProfile, updateSelfProfile } from "./profile.api";

const queries = createProfileQueries({
  queryKey: ["profile"],
  getFn: getSelfProfile,
  updateFn: updateSelfProfile,
});

export const profileKeys = queries.keys;
export const useSelfProfile = queries.useProfile;
export const useUpdateSelfProfile = queries.useUpdateProfile;
