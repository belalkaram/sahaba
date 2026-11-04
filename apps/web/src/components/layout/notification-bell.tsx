'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationApi, type AppNotification } from '../../lib/notification-api';
import { notificationHref, notificationText } from '../../features/notifications/notification-text';
import { formatNumber, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';

const POLL_MS = 60_000;

/** R8-2 — bell with the real unread count (polls every 60s) and the latest notifications. */
export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationApi.getNotifications(1);
      setItems(res.notifications.slice(0, 10));
      setUnread(res.meta.unread_count);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAll = async () => {
    await notificationApi.markAllAsRead();
    await refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `الإشعارات: ${formatNumber(unread)} غير مقروءة` : 'الإشعارات'}
        className="relative grid h-10 w-10 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden />
        {unread > 0 && (
          <span className="absolute end-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold leading-none text-danger-fg">
            {unread > 99 ? '+٩٩' : formatNumber(unread)}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-surface-raised shadow-lg">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-bold text-fg">الإشعارات</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <CheckCheck size={14} aria-hidden />
                تحديد الكل كمقروء
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {failed && <li className="px-4 py-6 text-center text-sm text-fg-muted">تعذّر تحميل الإشعارات.</li>}
            {!failed && items.length === 0 && <li className="px-4 py-6 text-center text-sm text-fg-muted">لا توجد إشعارات.</li>}
            {items.map((n) => (
              <li key={n.id} className={cn('border-b border-border-subtle last:border-0', !n.read_at && 'bg-primary-subtle/50')}>
                <Link href={notificationHref(n)} onClick={() => setOpen(false)} className="block px-4 py-3 transition-colors hover:bg-surface-muted">
                  <span className="block text-sm text-fg">{notificationText(n)}</span>
                  <span className="mt-0.5 block text-xs text-fg-subtle">{formatRelative(n.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border-subtle px-4 py-2.5 text-center text-sm font-semibold text-primary hover:bg-surface-muted">
            عرض كل الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}
