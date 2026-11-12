'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { platformCapacityApi, type CapacityRequestStatus, type PlatformCapacityRequest } from '../../../lib/capacity-api';
import { ApiError } from '../../../lib/api-client';
import { Tabs } from '../../../components/ui/tabs';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Pagination } from '../../../components/ui/pagination';
import { useToast } from '../../../components/ui/toast';
import { formatDateTime, formatNumber, normalizeDigits } from '../../../lib/format';

const STATUS: Record<CapacityRequestStatus, { label: string; variant: 'warning' | 'success' | 'danger' }> = {
  pending: { label: 'بانتظار القرار', variant: 'warning' },
  approved: { label: 'تمت الموافقة', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
};

type Decision = { kind: 'approve' | 'reject'; item: PlatformCapacityRequest } | null;

/** ADR-006: capacity requests from academies; the super admin approves (adds seats) or rejects with a reason. */
export function CapacityRequestsPanel({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<CapacityRequestStatus>('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: PlatformCapacityRequest[]; total: number; lastPage: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);
  const [seats, setSeats] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setData(null);
    try {
      setData(await platformCapacityApi.requests({ status, page }));
    } catch {
      setFailed(true);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openProof = async (id: string) => {
    try {
      const blob = await platformCapacityApi.proof(id);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } catch {
      toast.danger('تعذّر فتح الإثبات');
    }
  };

  const decide = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      if (decision.kind === 'approve') {
        const n = Number(normalizeDigits(seats));
        await platformCapacityApi.approve(decision.item.id, { seats_granted: Number.isInteger(n) && n > 0 ? n : undefined, note: text.trim() || undefined });
        toast.success('تمت الموافقة', 'أُضيفت المقاعد إلى حد المؤسسة.');
      } else {
        if (!text.trim()) {
          toast.warning('اكتب سبب الرفض');
          setBusy(false);
          return;
        }
        await platformCapacityApi.reject(decision.item.id, text.trim());
        toast.success('تم رفض الطلب');
      }
      setDecision(null);
      void load();
      onChanged();
    } catch (err) {
      toast.danger('تعذّر حفظ القرار', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        variant="underline"
        activeTab={status}
        onChange={(t) => {
          setStatus(t as CapacityRequestStatus);
          setPage(1);
        }}
        tabs={(Object.keys(STATUS) as CapacityRequestStatus[]).map((s) => ({ id: s, label: STATUS[s].label }))}
      />
      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
      ) : data.items.length === 0 ? (
        <EmptyState title="لا توجد طلبات هنا" description="تظهر هنا طلبات زيادة السعة التي ترسلها المؤسسات والمعلمون المستقلون." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-fg">{r.tenant?.name ?? '—'}</p>
                  <p className="ltr-isolate text-xs text-fg-muted">{r.tenant?.slug}</p>
                </div>
                <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-4">
                <Info label="المطلوب" value={`${formatNumber(r.seats_requested)} مقعداً`} />
                <Info label="المبلغ" value={r.amount !== null ? `${formatNumber(r.amount)} ${r.currency}` : '—'} />
                <Info label="الاستخدام عند الطلب" value={`${formatNumber(r.seats_used_at_request ?? 0)} من ${formatNumber(r.quota_at_request ?? 0)}`} />
                <Info label="الحد الحالي" value={r.tenant?.seat_quota !== null && r.tenant?.seat_quota !== undefined ? formatNumber(r.tenant.seat_quota) : 'لم يُحدَّد'} />
              </dl>
              {r.note && <p className="rounded-md bg-surface-sunken p-2 text-sm text-fg">ملاحظة المؤسسة: {r.note}</p>}
              {r.status !== 'pending' && (
                <p className="text-sm text-fg-muted">
                  {r.status === 'approved' ? `أُضيف ${formatNumber(r.seats_granted ?? 0)} مقعداً (الحد ${formatNumber(r.quota_after ?? 0)})` : 'رُفض'}
                  {r.reviewed_by_name ? ` · ${r.reviewed_by_name}` : ''}
                  {r.reviewed_at ? ` · ${formatDateTime(r.reviewed_at)}` : ''}
                  {r.decision_note ? ` · ${r.decision_note}` : ''}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-fg-muted">
                <span>
                  {r.requested_by_name ?? ''} {r.created_at ? `· ${formatDateTime(r.created_at)}` : ''}
                </span>
                <div className="flex flex-wrap gap-2">
                  {r.has_proof && (
                    <Button size="sm" variant="secondary" onClick={() => void openProof(r.id)}>
                      <FileText size={15} aria-hidden /> عرض الإثبات
                    </Button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setDecision({ kind: 'reject', item: r }); setText(''); }}>
                        رفض
                      </Button>
                      <Button size="sm" onClick={() => { setDecision({ kind: 'approve', item: r }); setSeats(String(r.seats_requested)); setText(''); }}>
                        موافقة وإضافة المقاعد
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && data.lastPage > 1 && <Pagination currentPage={page} totalPages={data.lastPage} onPageChange={setPage} totalItems={data.total} pageSize={20} />}

      <Modal
        isOpen={Boolean(decision)}
        onClose={() => !busy && setDecision(null)}
        title={decision?.kind === 'approve' ? 'الموافقة على زيادة السعة' : 'رفض الطلب'}
        subtitle={decision?.item.tenant?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button variant={decision?.kind === 'reject' ? 'danger' : 'primary'} onClick={() => void decide()} isLoading={busy}>
              {decision?.kind === 'approve' ? 'موافقة' : 'رفض الطلب'}
            </Button>
          </div>
        }
      >
        {decision?.kind === 'approve' ? (
          <div className="space-y-4">
            <Input label="عدد المقاعد الممنوحة" inputMode="numeric" value={seats} onChange={(e) => setSeats(e.target.value)} helperText="يمكنك منح عدد أقل من المطلوب." />
            <Textarea label="ملاحظة للمؤسسة (اختياري)" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        ) : (
          <Textarea label="سبب الرفض" rows={3} value={text} onChange={(e) => setText(e.target.value)} required />
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg">{value}</dd>
    </div>
  );
}
