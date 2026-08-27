import { apiClient } from "@/services/api-client";
import type {
  MarkAllReadResponse,
  NotificationListParams,
  NotificationListResponse,
  NotificationResponse,
  UnreadCountResponse,
} from "./notification.types";

export async function getNotifications(params: NotificationListParams = {}): Promise<NotificationListResponse> {
  const response = await apiClient.get<NotificationListResponse>("/notifications", { params });
  return response.data;
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const response = await apiClient.get<UnreadCountResponse>("/notifications/unread-count");
  return response.data;
}

export async function markNotificationRead(id: string): Promise<NotificationResponse> {
  const response = await apiClient.patch<NotificationResponse>(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  const response = await apiClient.patch<MarkAllReadResponse>("/notifications/read-all");
  return response.data;
}
