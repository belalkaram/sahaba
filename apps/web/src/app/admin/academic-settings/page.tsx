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
import { normalizeDigits } from '../../../lib/format';

interface AcademicSettings {
  notify_parents_on_absence: boolean;
  at_risk_attendance_below: number;
  at_risk_score_below: number;
  /** OD-35: minimum attendance % to sit exams; null = no rule. */
  min_attendance_for_exams: number | string | null;
}

/** R8 — tenant notification and at-risk settings. */
export default function AcademicSettingsPage() {
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const requireAttendance = settings !== null && settings.min_attendance_for_exams !== null;

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
        min_attendance_for_exams: requireAttendance ? Number(normalizeDigits(String(settings.min_attendance_for_exams ?? ''))) : null,
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
        description="تنبيهات أولياء الأمور، وشرط الحضور لدخول الاختبارات، وحدود الطلاب المعرّضين للتعثر."
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
            <CardHeader
              title="شرط الحضور لدخول الاختبارات"
              description="اختياري. عند تفعيله لا يبدأ الطالب أي اختبار إذا قلّت نسبة حضوره المسجّلة عن الحد. الطالب الذي لم يُسجَّل له حضور بعد لا يُمنع."
            />
            <div className="space-y-4">
              <Switch
                checked={requireAttendance}
                onChange={(v) => setSettings({ ...settings, min_attendance_for_exams: v ? '' : null })}
                label="اشتراط حد أدنى لنسبة الحضور"
              />
              {requireAttendance && (
                <Input
                  label="الحد الأدنى لنسبة الحضور (٪)"
                  inputMode="decimal"
                  value={String(settings.min_attendance_for_exams ?? '')}
                  onChange={(e) => setSettings({ ...settings, min_attendance_for_exams: e.target.value })}
                  helperText="من ١ إلى ١٠٠. يظهر هذا الحد للطلاب وأولياء الأمور."
                />
              )}
            </div>
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
