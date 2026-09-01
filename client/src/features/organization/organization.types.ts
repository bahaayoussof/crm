// Departments & Branches — shared organizational entities assigned to internal
// users and usable in ticket filtering and reporting.

export interface DepartmentOption {
  id: string;
  name: string;
  branchId: string | null;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string | null;
}

// feature/team-based-manager-scope — Team is the real Manager management unit.
export interface TeamOption {
  id: string;
  name: string;
  departmentId: string;
  managerId: string | null;
}

export interface Team {
  id: string;
  name: string;
  isActive: boolean;
  departmentId: string;
  managerId: string | null;
  department: { id: string; name: string; branchId: string | null };
  manager: { id: string; name: string; email: string } | null;
  agentCount: number;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamListResponse {
  data: Team[];
  meta: OrgListMeta;
}

export interface TeamAdminFilters {
  search: string;
  status?: "active" | "inactive";
  departmentId?: string;
  page: number;
  limit: number;
}

export interface TeamInput {
  name?: string;
  departmentId?: string;
  managerId?: string | null;
  isActive?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  branchId: string | null;
  branch: { id: string; name: string } | null;
  userCount: number;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  isActive: boolean;
  departmentCount: number;
  userCount: number;
  ticketCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DepartmentListResponse {
  data: Department[];
  meta: OrgListMeta;
}

export interface BranchListResponse {
  data: Branch[];
  meta: OrgListMeta;
}

export interface OrgAdminFilters {
  search: string;
  status?: "active" | "inactive";
  page: number;
  limit: number;
}

export interface DepartmentInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  branchId?: string | null;
}

export interface BranchInput {
  name?: string;
  code?: string | null;
  address?: string;
  isActive?: boolean;
}
