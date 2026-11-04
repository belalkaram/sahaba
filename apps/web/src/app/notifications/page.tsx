'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Settings2 } from 'lucide-react';
import { buttonClasses } from '../../components/ui/button-styles';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import { notificationApi, type NotificationResponse } from '../../lib/notification-api';
import { notificationHref, notificationText } from '../../features/notifications/notification-text';
import { formatDual, formatNumber, formatRelative } from '../../lib/format';
import { cn } from '../../lib/cn';

/** R8-2 — full notification list with mark-as-read. */
export default function NotificationsPage() {
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await notificationApi.getNotifications(page));
    } catch {
      setFailed(true);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return <ErrorState onRetry={load} />;

  const unread = data?.meta.unread_count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإشعارات"
        description={unread ? `لديك ${formatNumber(unread)} إشعار غير مقروء.` : 'كل إشعاراتك في مكان واحد.'}
        actions={
          <>
            <Link href="/notifications/preferences" className={buttonClasses('ghost', 'md')}>
              <Settings2 size={16} aria-hidden />
              الإعدادات
            </Link>
            {unread > 0 && (
              <Button
                variant="secondary"
                icon={<CheckCheck size={16} aria-hidden />}
                onClick={async () => {
                  await notificationApi.markAllAsRead();
                  await load();
                }}
              >
                تحديد الكل كمقروء
              </Button>
            )}
          </>
        }
      />

      {!data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.notifications.length === 0 ? (
        <EmptyState icon={<Bell size={24} strokeWidth={1.75} aria-hidden />} title="لا توجد إشعارات" description="عند وصول إشعار جديد سيظهر هنا." />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-border-subtle">
            {data.notifications.map((n) => (
              <li key={n.id} className={cn(!n.read_at && 'bg-primary-subtle/50')}>
                <Link
                  href={notificationHref(n)}
                  onClick={() => {
                    if (!n.read_at) notificationApi.markAsRead(n.id).catch(() => undefined);
                  }}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm text-fg', !n.read_at && 'font-semibold')}>{notificationText(n)}</span>
                    <span className="mt-1 block text-xs text-fg-subtle" title={formatDual(n.created_at)}>
                      {formatRelative(n.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data && data.meta.last_page > 1 && <Pagination currentPage={page} totalPages={data.meta.last_page} onPageChange={setPage} />}
    </div>
  );
}
