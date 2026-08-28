import type { Role } from "@/features/auth/auth.types";
import type { Task } from "./task.types";

/** Every internal role reaches the Tasks workspace. */
export function canUseTasks(role: Role) {
  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

/** ADMIN/MANAGER may reassign tasks to any active agent. */
export function canAssignTasks(role: Role) {
  return role === "ADMIN" || role === "MANAGER";
}

/**
 * Field-level edit rights, mirrored from the server permission matrix so the UI
 * disables what the API would reject.
 */
export function taskEditScope(task: Task, userId: string, role: Role) {
  const isAdminOrManager = role === "ADMIN" || role === "MANAGER";
  const isCreator = task.creatorId === userId;
  const isAssignee = task.assigneeId === userId;
  return {
    canEditContent: isAdminOrManager || isCreator,
    canEditStatus: isAdminOrManager || isCreator || isAssignee,
    canReassign: isAdminOrManager,
    canDelete: isAdminOrManager || isCreator,
  };
}
