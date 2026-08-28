export type TaskStatus = "OPEN" | "DONE";

export interface TaskPerson {
  id: string;
  name: string;
}

export interface TaskTicketRef {
  id: string;
  subject: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  remindedAt: string | null;
  ticketId: string | null;
  creatorId: string;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  creator: TaskPerson;
  assignee: TaskPerson;
  ticket: TaskTicketRef | null;
}

export interface TaskFilters {
  page: number;
  limit: number;
  search: string;
  status?: TaskStatus;
  assigneeId?: string;
}

export interface TaskListResponse {
  data: Task[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
