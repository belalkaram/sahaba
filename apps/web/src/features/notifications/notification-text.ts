import type { AppNotification } from '../../lib/notification-api';

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** Display text from the notification payload; never invents content. */
export function notificationText(n: AppNotification): string {
  return str(n.data?.message) ?? str(n.data?.title) ?? str(n.data?.body) ?? 'إشعار جديد';
}

/** In-app deep link when the payload carries a safe relative path. */
export function notificationHref(n: AppNotification): string {
  const link = str(n.data?.url) ?? str(n.data?.link);
  return link && link.startsWith('/') && !link.startsWith('//') ? link : '/notifications';
}
