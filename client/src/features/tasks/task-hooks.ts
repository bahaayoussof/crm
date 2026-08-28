import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  updateTask,
  type TaskCreatePayload,
  type TaskUpdatePayload,
} from "./task-api";
import type { TaskFilters } from "./task.types";

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: TaskFilters) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const useTasks = (filters: TaskFilters, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => getTasks(filters),
    enabled: options?.enabled ?? true,
  });

export const useTask = (id: string) =>
  useQuery({ queryKey: taskKeys.detail(id), queryFn: () => getTask(id), enabled: Boolean(id), retry: false });

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: (payload: TaskCreatePayload) => createTask(payload), onSuccess: () => invalidate() });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (payload: TaskUpdatePayload) => updateTask(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) }),
        invalidate(),
      ]);
    },
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({ mutationFn: deleteTask, onSuccess: () => invalidate() });
}
