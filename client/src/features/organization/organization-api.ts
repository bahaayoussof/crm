import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type {
  Branch,
  BranchInput,
  BranchListResponse,
  BranchOption,
  Department,
  DepartmentInput,
  DepartmentListResponse,
  DepartmentOption,
  OrgAdminFilters,
  Team,
  TeamAdminFilters,
  TeamInput,
  TeamListResponse,
  TeamOption,
} from "./organization.types";

// --- Active-only lookups (all internal roles) --------------------------------

export async function getDepartmentOptions() {
  return (await apiClient.get<ApiEnvelope<DepartmentOption[]>>("/departments")).data.data;
}

export async function getBranchOptions() {
  return (await apiClient.get<ApiEnvelope<BranchOption[]>>("/branches")).data.data;
}

export async function getTeamOptions(departmentId?: string) {
  return (
    await apiClient.get<ApiEnvelope<TeamOption[]>>("/teams", {
      params: departmentId ? { departmentId } : undefined,
    })
  ).data.data;
}

// --- Administrative CRUD (ADMIN only) ---------------------------------------

export async function getDepartments(filters: OrgAdminFilters) {
  return (await apiClient.get<DepartmentListResponse>("/settings/departments", { params: filters })).data;
}

export async function createDepartment(input: DepartmentInput) {
  return (await apiClient.post<ApiEnvelope<Department>>("/settings/departments", input)).data.data;
}

export async function updateDepartment(id: string, input: DepartmentInput) {
  return (await apiClient.patch<ApiEnvelope<Department>>(`/settings/departments/${id}`, input)).data.data;
}

export async function deleteDepartment(id: string) {
  await apiClient.delete(`/settings/departments/${id}`);
}

export async function getBranches(filters: OrgAdminFilters) {
  return (await apiClient.get<BranchListResponse>("/settings/branches", { params: filters })).data;
}

export async function createBranch(input: BranchInput) {
  return (await apiClient.post<ApiEnvelope<Branch>>("/settings/branches", input)).data.data;
}

export async function updateBranch(id: string, input: BranchInput) {
  return (await apiClient.patch<ApiEnvelope<Branch>>(`/settings/branches/${id}`, input)).data.data;
}

export async function deleteBranch(id: string) {
  await apiClient.delete(`/settings/branches/${id}`);
}

export async function getTeams(filters: TeamAdminFilters) {
  return (await apiClient.get<TeamListResponse>("/settings/teams", { params: filters })).data;
}

export async function createTeam(input: TeamInput) {
  return (await apiClient.post<ApiEnvelope<Team>>("/settings/teams", input)).data.data;
}

export async function updateTeam(id: string, input: TeamInput) {
  return (await apiClient.patch<ApiEnvelope<Team>>(`/settings/teams/${id}`, input)).data.data;
}

export async function deleteTeam(id: string) {
  await apiClient.delete(`/settings/teams/${id}`);
}
