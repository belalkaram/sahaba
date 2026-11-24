'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardHeader } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { ErrorState } from '../../../components/ui/error-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { ApiError } from '../../../lib/api-client';
import { billingApi, type PaymentMethod, type PaymentSettings } from '../../../lib/billing-api';

const METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'bank_transfer', label: 'تحويل بنكي', hint: 'يحتاج رقم الآيبان.' },
  { id: 'instapay', label: 'إنستاباي', hint: 'يحتاج عنوان إنستاباي.' },
  { id: 'cash', label: 'دفع نقدي لدى الأكاديمية', hint: 'يسجّل الطالب رقم الإيصال.' },
];

/** PAY-SET-1 — how students pay this academy for its packages. Nothing is enabled until the academy chooses. */
export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setSettings(await billingApi.getPaymentSettings());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return <ErrorState onRetry={load} />;

  const set = (patch: Partial<PaymentSettings>) => settings && setSettings({ ...settings, ...patch });
  const toggle = (id: PaymentMethod, on: boolean) =>
    settings &&
    set({ accepted_methods: on ? [...settings.accepted_methods, id] : settings.accepted_methods.filter((m) => m !== id) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    try {
      setSettings(await billingApi.updatePaymentSettings(settings));
      setMessage({ ok: true, text: 'تم حفظ وسائل الدفع. يراها الطلاب الآن عند الدفع.' });
    } catch (err) {
      const details = err instanceof ApiError ? (err.details as Record<string, string[]> | undefined) : undefined;
      if (details) setFieldErrors(Object.fromEntries(Object.entries(details).map(([k, v]) => [k, v[0]])));
      setMessage({ ok: false, text: 'تعذّر الحفظ. راجع الحقول المطلوبة.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="وسائل الدفع"
        description="ما يظهر للطالب عند دفع قيمة باقة. لا تظهر أي وسيلة للطلاب قبل أن تحدّدها هنا."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'وسائل الدفع' }]}
      />
      {!settings ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <form onSubmit={save} className="space-y-6">
          <Card>
            <CardHeader number="٠١" title="الوسائل المقبولة" />
            <div className="space-y-3">
              {METHODS.map((m) => (
                <Checkbox
                  key={m.id}
                  id={`method-${m.id}`}
                  label={m.label}
                  helperText={m.hint}
                  checked={settings.accepted_methods.includes(m.id)}
                  onChange={(e) => toggle(m.id, e.target.checked)}
                />
              ))}
            </div>
          </Card>

          {settings.accepted_methods.includes('bank_transfer') && (
            <Card>
              <CardHeader number="٠٢" title="الحساب البنكي" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="اسم البنك" value={settings.bank_name ?? ''} onChange={(e) => set({ bank_name: e.target.value })} />
                <Input
                  label="اسم المستفيد"
                  value={settings.account_holder_name ?? ''}
                  onChange={(e) => set({ account_holder_name: e.target.value })}
                />
                <Input
                  label="رقم الآيبان (IBAN)"
                  required
                  dir="ltr"
                  value={settings.iban ?? ''}
                  error={fieldErrors.iban}
                  onChange={(e) => set({ iban: e.target.value })}
                />
              </div>
            </Card>
          )}

          {settings.accepted_methods.includes('instapay') && (
            <Card>
              <CardHeader number="٠٣" title="إنستاباي" />
              <Input
                label="عنوان إنستاباي أو رقم الهاتف"
                required
                dir="ltr"
                value={settings.instapay_address ?? ''}
                error={fieldErrors.instapay_address}
                onChange={(e) => set({ instapay_address: e.target.value })}
              />
            </Card>
          )}

          <Card>
            <CardHeader title="تعليمات للطالب" description="اختياري. تظهر للطالب أسفل بيانات الدفع." />
            <Textarea value={settings.instructions ?? ''} onChange={(e) => set({ instructions: e.target.value })} rows={3} />
          </Card>

          {message && (
            <p role="status" className={message.ok ? 'text-sm text-success' : 'text-sm text-danger'}>
              {message.text}
            </p>
          )}
          <Button type="submit" isLoading={saving}>
            حفظ وسائل الدفع
          </Button>
        </form>
      )}
    </div>
  );
}
