import { apiClient } from './api-client';

export interface AppNotification {
  id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationMeta {
  current_page: number;
  last_page: number;
  total: number;
  unread_count: number;
}

export interface NotificationResponse {
  notifications: AppNotification[];
  meta: NotificationMeta;
}

export interface NotificationPreferenceItem {
  event: string;
  label: string;
  in_app: boolean;
  mail: boolean;
}

export const notificationApi = {
  async getPreferences(): Promise<NotificationPreferenceItem[]> {
    const res = await apiClient.get<{ preferences: NotificationPreferenceItem[] }>('/me/notification-preferences');
    return res.data.preferences;
  },

  async updatePreferences(preferences: Pick<NotificationPreferenceItem, 'event' | 'in_app' | 'mail'>[]): Promise<NotificationPreferenceItem[]> {
    const res = await apiClient.put<{ preferences: NotificationPreferenceItem[] }>('/me/notification-preferences', { preferences });
    return res.data.preferences;
  },

  /**
   * Fetch a paginated list of notifications for the authenticated user.
   */
  async getNotifications(page = 1): Promise<NotificationResponse> {
    const res = await apiClient.get<{ notifications: AppNotification[]; meta: NotificationMeta }>(`/notifications?page=${page}`);
    return res.data;
  },

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/${id}/read`, {});
  },

  /**
   * Mark all unread notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.post(`/notifications/read-all`, {});
  },
};
