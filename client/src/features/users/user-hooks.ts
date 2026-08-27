import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, getUser, getUsers, updateUser } from "./user-api";
import type { UserFilters, UserUpdatePayload } from "./user.types";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (filters: UserFilters) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

export const useUsers = (filters: UserFilters, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => getUsers(filters),
    enabled: options?.enabled ?? true,
  });

export const useUser = (id: string) =>
  useQuery({ queryKey: userKeys.detail(id), queryFn: () => getUser(id), enabled: Boolean(id), retry: false });

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: createUser, onSuccess: () => invalidate() });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload: UserUpdatePayload) => updateUser(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: userKeys.detail(id) }),
        invalidate(),
      ]);
    },
  });
}
