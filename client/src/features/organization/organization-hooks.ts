import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBranch,
  createDepartment,
  createTeam,
  deleteBranch,
  deleteDepartment,
  deleteTeam,
  getBranchOptions,
  getBranches,
  getDepartmentOptions,
  getDepartments,
  getTeamOptions,
  getTeams,
  updateBranch,
  updateDepartment,
  updateTeam,
} from "./organization-api";
import type { BranchInput, DepartmentInput, OrgAdminFilters, TeamAdminFilters, TeamInput } from "./organization.types";

export const organizationKeys = {
  all: ["organization"] as const,
  departmentOptions: ["organization", "departments", "options"] as const,
  branchOptions: ["organization", "branches", "options"] as const,
  teamOptions: (departmentId?: string) => ["organization", "teams", "options", departmentId ?? null] as const,
  departments: (filters: OrgAdminFilters) => ["organization", "departments", "list", filters] as const,
  branches: (filters: OrgAdminFilters) => ["organization", "branches", "list", filters] as const,
  teams: (filters: TeamAdminFilters) => ["organization", "teams", "list", filters] as const,
};

export const useDepartmentOptions = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: organizationKeys.departmentOptions,
    queryFn: getDepartmentOptions,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });

export const useBranchOptions = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: organizationKeys.branchOptions,
    queryFn: getBranchOptions,
    staleTime: 60_000,
    enabled: options?.enabled ?? true,
  });

/**
 * Active Team lookup, optionally scoped to one Department. The dependent query
 * stays disabled until a Department is chosen so the Team select never shows
 * options from another Department.
 */
export const useTeamOptions = (departmentId?: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: organizationKeys.teamOptions(departmentId),
    queryFn: () => getTeamOptions(departmentId),
    staleTime: 60_000,
    enabled: (options?.enabled ?? true) && Boolean(departmentId),
  });

export const useAdminDepartments = (filters: OrgAdminFilters) =>
  useQuery({ queryKey: organizationKeys.departments(filters), queryFn: () => getDepartments(filters) });

export const useAdminBranches = (filters: OrgAdminFilters) =>
  useQuery({ queryKey: organizationKeys.branches(filters), queryFn: () => getBranches(filters) });

export const useAdminTeams = (filters: TeamAdminFilters) =>
  useQuery({ queryKey: organizationKeys.teams(filters), queryFn: () => getTeams(filters) });

function useOrgInvalidate() {
  const queryClient = useQueryClient();
  // Departments/branches/teams surface in user management, ticket filters/forms,
  // manager console, dashboard and reports — invalidate broadly and let those
  // queries refetch.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["manager"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["reports"] }),
    ]);
}

export function useCreateDepartment() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (input: DepartmentInput) => createDepartment(input), onSuccess: invalidate });
}

export function useUpdateDepartment() {
  const invalidate = useOrgInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentInput }) => updateDepartment(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteDepartment() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteDepartment(id), onSuccess: invalidate });
}

export function useCreateBranch() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (input: BranchInput) => createBranch(input), onSuccess: invalidate });
}

export function useUpdateBranch() {
  const invalidate = useOrgInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BranchInput }) => updateBranch(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteBranch() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteBranch(id), onSuccess: invalidate });
}

export function useCreateTeam() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (input: TeamInput) => createTeam(input), onSuccess: invalidate });
}

export function useUpdateTeam() {
  const invalidate = useOrgInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TeamInput }) => updateTeam(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTeam() {
  const invalidate = useOrgInvalidate();
  return useMutation({ mutationFn: (id: string) => deleteTeam(id), onSuccess: invalidate });
}
