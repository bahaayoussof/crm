import { apiClient } from "@/services/api-client";
import type { ApiEnvelope } from "@/features/auth/auth.types";
import type { Task, TaskFilters, TaskListResponse, TaskStatus } from "./task.types";

export interface TaskCreatePayload {
  title: string;
  description?: string;
  dueAt?: string;
  assigneeId?: string;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  dueAt?: string | null;
  status?: TaskStatus;
  assigneeId?: string;
}

/** Convert a `datetime-local` value to an ISO instant; empty stays empty. */
export function localInputToIso(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export async function getTasks(filters: TaskFilters) {
  const params: Record<string, string | number> = {
    page: filters.page,
    limit: filters.limit,
  };
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.assigneeId) params.assigneeId = filters.assigneeId;
  const response = await apiClient.get<TaskListResponse>("/tasks", { params });
  return response.data;
}

export async function getTask(id: string) {
  const response = await apiClient.get<ApiEnvelope<Task>>(`/tasks/${id}`);
  return response.data.data;
}

export async function createTask(payload: TaskCreatePayload) {
  const response = await apiClient.post<ApiEnvelope<Task>>("/tasks", payload);
  return response.data.data;
}

export async function updateTask(id: string, payload: TaskUpdatePayload) {
  const response = await apiClient.patch<ApiEnvelope<Task>>(`/tasks/${id}`, payload);
  return response.data.data;
}

export async function deleteTask(id: string) {
  await apiClient.delete(`/tasks/${id}`);
}
