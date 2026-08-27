export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  ticketId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationListResponse {
  data: Notification[];
  meta: NotificationMeta;
}

export interface UnreadCountResponse {
  data: { count: number };
}

export interface NotificationResponse {
  data: Notification;
}

export interface MarkAllReadResponse {
  data: { updated: number };
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  read?: "true" | "false";
}
