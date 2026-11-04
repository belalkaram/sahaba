'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardHeader } from '../../../components/ui/card';
import { Switch } from '../../../components/ui/switch';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { apiClient } from '../../../lib/api-client';

interface AcademicSettings {
  notify_parents_on_absence: boolean;
  at_risk_attendance_below: number;
  at_risk_score_below: number;
}

/** R8 — tenant notification and at-risk settings. */
export default function AcademicSettingsPage() {
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await apiClient.get<AcademicSettings>('/tenant/academic-settings');
      setSettings(res.data);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiClient.put<AcademicSettings>('/tenant/academic-settings', {
        ...settings,
        at_risk_attendance_below: Number(settings.at_risk_attendance_below),
        at_risk_score_below: Number(settings.at_risk_score_below),
      });
      setSettings(res.data);
      setMessage({ ok: true, text: 'تم حفظ الإعدادات.' });
    } catch {
      setMessage({ ok: false, text: 'تعذّر الحفظ. تحقّق أن القيم بين ٠ و١٠٠.' });
    } finally {
      setSaving(false);
    }
  };

  if (failed) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات الأكاديمية"
        description="تنبيهات أولياء الأمور وحدود الطلاب المعرّضين للتعثر."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'الإعدادات الأكاديمية' }]}
      />
      {!settings ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <form onSubmit={save} className="space-y-6">
          <Card>
            <CardHeader title="إشعارات الغياب" />
            <Switch
              checked={settings.notify_parents_on_absence}
              onChange={(v) => setSettings({ ...settings, notify_parents_on_absence: v })}
              label="إشعار ولي الأمر عند تسجيل غياب الطالب"
            />
          </Card>
          <Card>
            <CardHeader title="الطلاب المعرّضون للتعثر" description="يظهر الطالب في القائمة إذا قلّ عن أي من الحدّين. لا يُحتسب من ليست له بيانات." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="نسبة الحضور أقل من (٪)"
                inputMode="decimal"
                value={String(settings.at_risk_attendance_below)}
                onChange={(e) => setSettings({ ...settings, at_risk_attendance_below: e.target.value as unknown as number })}
              />
              <Input
                label="المعدل العام أقل من (٪)"
                inputMode="decimal"
                value={String(settings.at_risk_score_below)}
                onChange={(e) => setSettings({ ...settings, at_risk_score_below: e.target.value as unknown as number })}
              />
            </div>
          </Card>
          {message && (
            <p role="status" className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
              {message.text}
            </p>
          )}
          <Button type="submit" isLoading={saving}>
            حفظ الإعدادات
          </Button>
        </form>
      )}
    </div>
  );
}
