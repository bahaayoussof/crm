import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@/features/auth/auth-state";
import { getPortalProfile, updatePortalProfile } from "./profile.api";

export const portalProfileKeys = {
  profile: ["portal", "profile"] as const,
};

export const usePortalProfile = () =>
  useQuery({ queryKey: portalProfileKeys.profile, queryFn: getPortalProfile });

export function useUpdatePortalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePortalProfile,
    onSuccess: async (profile) => {
      queryClient.setQueryData(portalProfileKeys.profile, profile);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalProfileKeys.profile }),
        // Header/avatar reads name/email from the auth user cache.
        queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
      ]);
    },
  });
}
