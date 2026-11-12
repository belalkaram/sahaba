'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Gauge, KeyRound, Landmark, Send } from 'lucide-react';
import { ApiError } from '../../../lib/api-client';
import { capacityApi, type CapacitySummary, type TenantCapacityRequest, type TransferDetails } from '../../../lib/capacity-api';
import { PageHeader } from '../../../components/ui/page-header';
import { Card, CardHeader } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { FileUpload } from '../../../components/ui/file-upload';
import { ErrorState } from '../../../components/ui/error-state';
import { Forbidden } from '../../../components/ui/forbidden';
import { useToast } from '../../../components/ui/toast';
import { formatDateTime, formatNumber, normalizeDigits } from '../../../lib/format';

const STATUS = {
  pending: { label: 'قيد مراجعة إدارة المنصة', variant: 'warning' },
  approved: { label: 'تمت الموافقة', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
} as const;

type Load = { s: 'loading' } | { s: 'forbidden' } | { s: 'error' } | { s: 'ready'; capacity: CapacitySummary; pending: TenantCapacityRequest | null; transfer: TransferDetails | null; history: TenantCapacityRequest[] };

/** ADR-006 (CAP-1): seats of the academy and requests to the platform for more. Only the super admin grants seats. */
export default function CapacityPage() {
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [seats, setSeats] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [summary, history] = await Promise.all([capacityApi.summary(), capacityApi.requests().catch(() => [] as TenantCapacityRequest[])]);
      setLoad({ s: 'ready', capacity: summary.capacity, pending: summary.pending_request, transfer: summary.transfer, history });
    } catch (err) {
      setLoad(err instanceof ApiError && err.status === 403 ? { s: 'forbidden' } : { s: 'error' });
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    const seatsN = Number(normalizeDigits(seats));
    const amountN = Number(normalizeDigits(amount));
    if (!Number.isInteger(seatsN) || seatsN < 1) found.seats = 'اكتب عدداً صحيحاً من ١ فأكثر.';
    if (!amount.trim() || Number.isNaN(amountN) || amountN < 0) found.amount = 'اكتب المبلغ الذي حوّلته.';
    if (!proof) found.proof = 'أرفق صورة أو ملف إثبات التحويل.';
    setErrors(found);
    if (Object.keys(found).length || !proof) return;
    setSending(true);
    try {
      await capacityApi.request({ seats: seatsN, amount: amountN, proof, note: note.trim() || undefined });
      toast.success('أُرسل الطلب', 'ستراجع إدارة المنصة التحويل وتضيف المقاعد.');
      setSeats('');
      setAmount('');
      setNote('');
      setProof(null);
      void fetchAll();
    } catch (err) {
      toast.danger('تعذّر إرسال الطلب', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  if (load.s === 'forbidden') return <Forbidden />;
  if (load.s === 'error') return <ErrorState onRetry={() => void fetchAll()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="السعة: الطلاب والأكواد"
        description="كل طالب = كود واحد يعمل على جهاز واحد. كود إضافي لجهاز ثانٍ يأخذ مقعداً إضافياً. لزيادة العدد اطلب من إدارة المنصة بعد التحويل."
        breadcrumbs={[{ label: 'لوحة المؤسسة', href: '/admin' }, { label: 'السعة' }]}
      />

      {load.s === 'loading' ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
      ) : (
        <>
          <Card>
            <CardHeader title="المقاعد المستخدمة" icon={<Gauge size={18} aria-hidden />} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="المستخدم" value={load.capacity.used} />
              <Stat label="الحد المسموح" value={load.capacity.quota} />
              <Stat label="المتاح" value={load.capacity.available} tone={load.capacity.available === 0 ? 'danger' : 'success'} />
            </div>
            <div className="mt-4">
              <ProgressBar value={load.capacity.quota ? (load.capacity.used / load.capacity.quota) * 100 : 100} variant={load.capacity.available === 0 ? 'danger' : 'primary'} />
            </div>
            {load.capacity.available === 0 && (
              <p role="alert" className="mt-3 rounded-md border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-subtle-fg">
                اكتمل العدد: لا يمكن إضافة طالب أو إصدار كود لجهاز إضافي حتى توافق إدارة المنصة على زيادة.
              </p>
            )}
          </Card>

          {load.pending ? (
            <Card>
              <CardHeader title="طلب زيادة قيد المراجعة" icon={<Send size={18} aria-hidden />} />
              <p className="text-sm text-fg">
                طلبت {formatNumber(load.pending.seats_requested)} مقعداً بتاريخ {load.pending.created_at ? formatDateTime(load.pending.created_at) : '—'}. ستصلك الزيادة فور موافقة إدارة المنصة.
              </p>
            </Card>
          ) : (
            <form onSubmit={submit} noValidate>
              <Card>
                <CardHeader title="طلب زيادة السعة" description="الدفع حالياً بالتحويل البنكي اليدوي. حوّل المبلغ ثم أرفق الإثبات." icon={<KeyRound size={18} aria-hidden />} />
                {load.transfer && (load.transfer.iban || load.transfer.bank_name) && (
                  <div className="mb-4 space-y-1 rounded-md border border-border bg-surface-sunken p-3 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-fg">
                      <Landmark size={16} aria-hidden /> بيانات التحويل
                    </p>
                    {load.transfer.bank_name && <p>البنك: {load.transfer.bank_name}</p>}
                    {load.transfer.account_holder_name && <p>اسم المستفيد: {load.transfer.account_holder_name}</p>}
                    {load.transfer.iban && (
                      <p>
                        الآيبان: <span className="ltr-isolate font-mono font-semibold">{load.transfer.iban}</span>
                      </p>
                    )}
                    {load.transfer.instructions && <p className="whitespace-pre-line text-fg-muted">{load.transfer.instructions}</p>}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="عدد المقاعد المطلوبة" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} error={errors.seats} required />
                  <Input label="المبلغ المحوَّل (ر.س)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} required />
                </div>
                <div className="mt-4 space-y-4">
                  <FileUpload label="إثبات التحويل" accept="image/jpeg,image/png,image/webp,application/pdf" maxSizeMB={5} selectedFile={proof} onFileSelect={setProof} onClear={() => setProof(null)} error={errors.proof} helperText="صورة أو PDF حتى ٥ ميجابايت." />
                  <Textarea label="ملاحظة (اختياري)" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="submit" isLoading={sending}>
                    <Send size={16} aria-hidden /> إرسال الطلب
                  </Button>
                </div>
              </Card>
            </form>
          )}

          <Card>
            <CardHeader title="سجل الطلبات" />
            {load.history.length === 0 ? (
              <p className="text-sm text-fg-muted">لا توجد طلبات سابقة.</p>
            ) : (
              <ul className="divide-y divide-border">
                {load.history.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-fg">
                        {formatNumber(r.seats_requested)} مقعداً — {r.amount !== null ? `${formatNumber(r.amount)} ${r.currency}` : '—'}
                      </p>
                      <p className="text-fg-muted">
                        {r.created_at ? formatDateTime(r.created_at) : ''}
                        {r.requested_by_name ? ` · ${r.requested_by_name}` : ''}
                      </p>
                      {r.status === 'approved' && r.seats_granted !== null && <p className="text-success">أُضيف {formatNumber(r.seats_granted)} مقعداً، الحد الآن {formatNumber(r.quota_after ?? 0)}.</p>}
                      {r.decision_note && <p className="text-fg-muted">ملاحظة الإدارة: {r.decision_note}</p>}
                    </div>
                    <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-4">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-fg'}`}>{formatNumber(value)}</p>
    </div>
  );
}
