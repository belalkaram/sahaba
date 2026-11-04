'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Inbox } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardHeader } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Pagination } from '../../../components/ui/pagination';
import { Skeleton } from '../../../components/ui/skeleton';
import { platformApi, type ContactMessagesResponse, type PlatformSettings } from '../../../lib/platform-api';
import { formatDateTime } from '../../../lib/format';

/** R7F — platform settings (OD-20 demo login switch) and messages from the public contact form. */
export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [messages, setMessages] = useState<ContactMessagesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [s, m] = await Promise.all([platformApi.getSettings(), platformApi.getContactMessages(page)]);
      setSettings(s);
      setMessages(m);
    } catch {
      setFailed(true);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDemo = async (next: boolean) => {
    setSaving(true);
    setSaveError(null);
    try {
      setSettings(await platformApi.updateSettings({ demo_login_enabled: next }));
    } catch {
      setSaveError('لم يُحفظ التغيير. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const markHandled = async (id: number) => {
    await platformApi.markContactMessageHandled(id);
    await load();
  };

  if (failed) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="إعدادات المنصة"
        description="إعدادات تنطبق على المنصة كلها، ورسائل نموذج التواصل."
        breadcrumbs={[{ label: 'نظرة عامة', href: '/platform/dashboard' }, { label: 'الإعدادات' }]}
      />

      <Card>
        <CardHeader title="الدخول التجريبي" description="يتحكم في ظهور الحسابات التجريبية بصفحة تسجيل الدخول في بيئة الإنتاج." />
        {settings ? (
          <Switch
            checked={settings.demo_login_enabled}
            onChange={toggleDemo}
            disabled={saving}
            label="إظهار الحسابات التجريبية في صفحة الدخول"
            description="يجب أن يبقى مطفأً في الإنتاج الفعلي. الإخفاء لا يحذف الحسابات: لا تشغّل بيانات العرض في الإنتاج."
          />
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {saveError}
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="رسائل التواصل" description="ما أرسله الزوار عبر صفحة «تواصل معنا»." />
        {!messages ? (
          <Skeleton className="h-40 w-full" />
        ) : messages.messages.length === 0 ? (
          <EmptyState compact icon={<Inbox size={24} strokeWidth={1.75} aria-hidden />} title="لا توجد رسائل" description="ستظهر هنا الرسائل الجديدة." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {messages.messages.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-fg">
                    {m.name}
                    {m.institution && <span className="font-normal text-fg-muted"> — {m.institution}</span>}
                  </p>
                  <p className="text-xs text-fg-muted">
                    <span className="ltr-isolate">{m.email}</span>
                    {m.phone && (
                      <>
                        {' · '}
                        <span className="ltr-isolate">{m.phone}</span>
                      </>
                    )}
                    {' · '}
                    {formatDateTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{m.message}</p>
                </div>
                <div className="shrink-0">
                  {m.status === 'handled' ? (
                    <Badge variant="success" size="sm" icon={<Check size={12} aria-hidden />}>
                      تمت المعالجة
                    </Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => markHandled(m.id)}>
                      تحديد كمعالَجة
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {messages && messages.pagination.last_page > 1 && (
          <div className="mt-4">
            <Pagination currentPage={page} totalPages={messages.pagination.last_page} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
