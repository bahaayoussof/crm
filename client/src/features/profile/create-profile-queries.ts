import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { AUTH_QUERY_KEY } from "@/features/auth/auth-state";
import type { SelfProfile, SelfProfileUpdate } from "./profile.types";

interface ProfileQueriesConfig {
  queryKey: QueryKey;
  getFn: () => Promise<SelfProfile>;
  updateFn: (body: SelfProfileUpdate) => Promise<SelfProfile>;
}

interface ProfileQueries {
  keys: { profile: QueryKey };
  useProfile: () => UseQueryResult<SelfProfile>;
  useUpdateProfile: () => UseMutationResult<SelfProfile, unknown, SelfProfileUpdate>;
}

/**
 * Builds the concrete `useProfile` / `useUpdateProfile` hooks for one shell.
 * Called once at module setup in each shell's `profile.queries.ts` — never with
 * a config passed in at hook-call time.
 */
export function createProfileQueries({ queryKey, getFn, updateFn }: ProfileQueriesConfig): ProfileQueries {
  const useProfile = () => useQuery({ queryKey, queryFn: getFn });

  const useUpdateProfile = () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: updateFn,
      onSuccess: async (profile) => {
        queryClient.setQueryData(queryKey, profile);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
          // Header / sidebar identity reads name + email from the auth-user cache.
          queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
        ]);
      },
    });
  };

  return { keys: { profile: queryKey }, useProfile, useUpdateProfile };
}
