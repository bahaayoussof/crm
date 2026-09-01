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

/**
 * Active MANAGER users, for the Team Management "assign manager" select.
 * ADMIN-only surface (the `/users` list route is ADMIN-only).
 */
export const useManagerOptions = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: [...userKeys.lists(), "manager-options"] as const,
    queryFn: () => getUsers({ page: 1, limit: 100, search: "", role: "MANAGER", status: "active" }),
    select: (response) => response.data.map((user) => ({ id: user.id, name: user.name, email: user.email })),
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });

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
