'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { registrationRequestsApi, type RegistrationRequestItem } from '../../../lib/admin-api';
import { ApiError } from '../../../lib/api-client';
import { PageHeader } from '../../../components/ui/page-header';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Forbidden } from '../../../components/ui/forbidden';
import { Modal } from '../../../components/ui/modal';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { RequestCard } from '../../../features/registration/request-card';
import { cn } from '../../../lib/cn';

type Filter = 'pending' | 'approved' | 'rejected';
const TABS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'بانتظار القرار' },
  { value: 'approved', label: 'المقبولة' },
  { value: 'rejected', label: 'المرفوضة' },
];

type Load = { s: 'loading' } | { s: 'forbidden' } | { s: 'error' } | { s: 'ready'; items: RegistrationRequestItem[]; lastPage: number };

/** Student self-registration inbox for the tenant admin / independent teacher. */
export default function RegistrationRequestsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const [load, setLoad] = useState<Load>({ s: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ item: RegistrationRequestItem; kind: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { items, lastPage } = await registrationRequestsApi.list(filter, page);
      setLoad({ s: 'ready', items, lastPage });
    } catch (err) {
      setLoad(err instanceof ApiError && err.status === 403 ? { s: 'forbidden' } : { s: 'error' });
    }
  }, [filter, page]);

  useEffect(() => {
    setLoad({ s: 'loading' });
    void refresh();
  }, [refresh]);

  const confirm = async () => {
    if (!decision) return;
    setBusyId(decision.item.id);
    setActionError(null);
    try {
      if (decision.kind === 'approve') await registrationRequestsApi.approve(decision.item.id, note.trim() || undefined);
      else await registrationRequestsApi.reject(decision.item.id, note.trim() || undefined);
      setDecision(null);
      setNote('');
      await refresh();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.status === 422
          ? `تعذّر القبول: ${Object.values(err.details ?? {}).flat().join(' ') || 'بيانات مكررة'}. راجع الحساب الموجود أو ارفض الطلب.`
          : err instanceof ApiError && err.status === 409
            ? 'تم البتّ في هذا الطلب مسبقًا.'
            : 'تعذّر تنفيذ الإجراء. حاول مرة أخرى.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (load.s === 'forbidden') return <Forbidden title="غير مصرح" description="قبول طلبات التسجيل يتطلب صلاحية إدارة الطلاب على مستوى المؤسسة." />;

  return (
    <div className="space-y-6">
      <PageHeader title="طلبات التسجيل" subtitle="طلبات الطلاب الراغبين بالانضمام إليك. عند القبول يُنشأ حساب الطالب ويُربط بولي أمره برقم جواله." />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="حالة الطلبات">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={filter === t.value}
            onClick={() => {
              setFilter(t.value);
              setPage(1);
            }}
            className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors', filter === t.value ? 'border-primary bg-primary-subtle text-primary-subtle-fg' : 'border-border bg-surface text-fg-muted hover:bg-surface-muted')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {load.s === 'loading' && <div className="h-48 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />}
      {load.s === 'error' && <ErrorState title="تعذّر تحميل الطلبات" description="تحقق من الاتصال ثم أعد المحاولة." onRetry={() => void refresh()} />}
      {load.s === 'ready' && load.items.length === 0 && (
        <EmptyState icon={<UserPlus size={20} aria-hidden />} title="لا توجد طلبات" description={filter === 'pending' ? 'لا توجد طلبات تسجيل بانتظار قرارك. فعّل استقبال الطلبات من إعدادات المؤسسة لتظهر في صفحة التسجيل.' : 'لا توجد طلبات في هذه الحالة.'} />
      )}
      {load.s === 'ready' && load.items.length > 0 && (
        <div className="space-y-4">
          {load.items.map((item) => (
            <RequestCard key={item.id} item={item} busy={busyId === item.id} onApprove={() => setDecision({ item, kind: 'approve' })} onReject={() => setDecision({ item, kind: 'reject' })} />
          ))}
          {load.lastPage > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
              <span className="text-sm text-fg-muted">{page} / {load.lastPage}</span>
              <Button variant="secondary" size="sm" disabled={page >= load.lastPage} onClick={() => setPage((p) => p + 1)}>التالي</Button>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setActionError(null);
        }}
        title={decision?.kind === 'approve' ? 'قبول الطلب' : 'رفض الطلب'}
        subtitle={decision?.item.full_name}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={Boolean(busyId)}>إلغاء</Button>
            <Button variant={decision?.kind === 'approve' ? 'primary' : 'danger'} onClick={confirm} isLoading={Boolean(busyId)} disabled={Boolean(busyId)}>
              {decision?.kind === 'approve' ? 'قبول وإنشاء الحساب' : 'تأكيد الرفض'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">
          {decision?.kind === 'approve'
            ? 'سيُنشأ حساب الطالب ويدخل برقم جواله وكلمة المرور التي اختارها، ويُربط ولي الأمر برقم جواله.'
            : 'لن يُنشأ حساب، ولا يمكن التراجع عن الرفض.'}
        </p>
        <Textarea label="ملاحظة (اختياري)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        {actionError && <p role="alert" className="text-sm font-medium text-danger">{actionError}</p>}
      </Modal>
    </div>
  );
}
