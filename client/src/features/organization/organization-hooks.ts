import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBranch,
  createDepartment,
  deleteBranch,
  deleteDepartment,
  getBranchOptions,
  getBranches,
  getDepartmentOptions,
  getDepartments,
  updateBranch,
  updateDepartment,
} from "./organization-api";
import type { BranchInput, DepartmentInput, OrgAdminFilters } from "./organization.types";

export const organizationKeys = {
  all: ["organization"] as const,
  departmentOptions: ["organization", "departments", "options"] as const,
  branchOptions: ["organization", "branches", "options"] as const,
  departments: (filters: OrgAdminFilters) => ["organization", "departments", "list", filters] as const,
  branches: (filters: OrgAdminFilters) => ["organization", "branches", "list", filters] as const,
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

export const useAdminDepartments = (filters: OrgAdminFilters) =>
  useQuery({ queryKey: organizationKeys.departments(filters), queryFn: () => getDepartments(filters) });

export const useAdminBranches = (filters: OrgAdminFilters) =>
  useQuery({ queryKey: organizationKeys.branches(filters), queryFn: () => getBranches(filters) });

function useOrgInvalidate() {
  const queryClient = useQueryClient();
  // Departments/branches surface in user management, ticket filters and reports,
  // so invalidate broadly and let those queries refetch.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["users"] }),
      queryClient.invalidateQueries({ queryKey: ["tickets"] }),
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
