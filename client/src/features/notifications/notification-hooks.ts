import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getNotifications, getUnreadCount, markAllNotificationsRead, markNotificationRead } from "./notification-api";
import type { NotificationListParams } from "./notification.types";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params: NotificationListParams) => [...notificationKeys.lists(), params] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export const useNotifications = (params: NotificationListParams = {}) =>
  useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => getNotifications(params),
  });

/** Polls every 30 seconds. Only call for authenticated internal users. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    // Do not retry aggressively — background polling
    retry: 1,
  });

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() }),
    ]);
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: (id: string) => markNotificationRead(id), onSuccess: () => invalidate() });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => invalidate() });
}
