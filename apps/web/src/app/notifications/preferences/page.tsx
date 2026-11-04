'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { ErrorState } from '../../../components/ui/error-state';
import { TableSkeleton } from '../../../components/ui/skeleton';
import { notificationApi, type NotificationPreferenceItem } from '../../../lib/notification-api';

/** R8-1 — each user chooses in-app and email delivery per event. */
export default function NotificationPreferencesPage() {
  const [items, setItems] = useState<NotificationPreferenceItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems(await notificationApi.getPreferences());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (item: NotificationPreferenceItem, patch: Partial<NotificationPreferenceItem>) => {
    const next = { ...item, ...patch };
    setSaveError(null);
    setItems((list) => list?.map((i) => (i.event === item.event ? next : i)) ?? null);
    try {
      setItems(await notificationApi.updatePreferences([{ event: next.event, in_app: next.in_app, mail: next.mail }]));
    } catch {
      setSaveError('لم يُحفظ التغيير. حاول مرة أخرى.');
      await load();
    }
  };

  if (failed) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات الإشعارات"
        description="اختر ما يصلك داخل المنصة وعلى بريدك الإلكتروني."
        breadcrumbs={[{ label: 'الإشعارات', href: '/notifications' }, { label: 'الإعدادات' }]}
      />
      {saveError && (
        <p role="alert" className="text-sm text-danger">
          {saveError}
        </p>
      )}
      <Card padding="none" className="overflow-x-auto" tabIndex={0}>
        {!items ? (
          <div className="p-5">
            <TableSkeleton rows={6} cols={3} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-fg-muted">
                <th className="px-5 py-3 text-start font-semibold">الإشعار</th>
                <th className="px-5 py-3 text-start font-semibold">داخل المنصة</th>
                <th className="px-5 py-3 text-start font-semibold">البريد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {items.map((item) => (
                <tr key={item.event}>
                  <td className="px-5 py-3 font-medium text-fg">{item.label}</td>
                  <td className="px-5 py-3">
                    <Switch checked={item.in_app} onChange={(v) => change(item, { in_app: v })} id={`${item.event}-app`} ariaLabel={`${item.label}: داخل المنصة`} />
                  </td>
                  <td className="px-5 py-3">
                    <Switch checked={item.mail} onChange={(v) => change(item, { mail: v })} id={`${item.event}-mail`} ariaLabel={`${item.label}: البريد`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
