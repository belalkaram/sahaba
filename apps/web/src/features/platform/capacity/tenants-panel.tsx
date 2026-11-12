'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { platformCapacityApi, type PlatformTenantCapacity } from '../../../lib/capacity-api';
import { ApiError } from '../../../lib/api-client';
import { Card, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Modal } from '../../../components/ui/modal';
import { SearchInput } from '../../../components/ui/search-input';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { Pagination } from '../../../components/ui/pagination';
import { ErrorState } from '../../../components/ui/error-state';
import { useToast } from '../../../components/ui/toast';
import { formatNumber, normalizeDigits } from '../../../lib/format';

/** ADR-006: default quota for new academies and the quota / usage of each academy. */
export function CapacityTenantsPanel({ refreshKey }: { refreshKey: number }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: PlatformTenantCapacity[]; total: number; lastPage: number; defaultQuota: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [savingDefault, setSavingDefault] = useState(false);
  const [editing, setEditing] = useState<PlatformTenantCapacity | null>(null);
  const [quota, setQuota] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await platformCapacityApi.tenants({ search: search || undefined, page });
      setData(res);
      setDefaultValue((v) => (v === '' ? String(res.defaultQuota) : v));
    } catch {
      setFailed(true);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const saveDefault = async () => {
    const n = Number(normalizeDigits(defaultValue));
    if (!Number.isInteger(n) || n < 0) return toast.warning('اكتب عدداً صحيحاً');
    setSavingDefault(true);
    try {
      const saved = await platformCapacityApi.setDefault(n);
      setDefaultValue(String(saved));
      toast.success('تم الحفظ', 'تبدأ المؤسسات الجديدة بهذا العدد.');
    } catch {
      toast.danger('تعذّر الحفظ');
    } finally {
      setSavingDefault(false);
    }
  };

  const saveQuota = async () => {
    if (!editing) return;
    const n = Number(normalizeDigits(quota));
    if (!Number.isInteger(n) || n < 0 || !reason.trim()) return toast.warning('اكتب الحد الجديد والسبب');
    setBusy(true);
    try {
      await platformCapacityApi.setQuota(editing.id, n, reason.trim());
      toast.success('تم تعديل الحد');
      setEditing(null);
      void load();
    } catch (err) {
      toast.danger('تعذّر التعديل', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="الحد الافتراضي للمؤسسات الجديدة" description="عدد المقاعد (طالب = كود) الذي تبدأ به أي مؤسسة أو معلم مستقل عند التسجيل." />
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input label="عدد المقاعد" inputMode="numeric" value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
          </div>
          <Button onClick={() => void saveDefault()} isLoading={savingDefault}>
            حفظ
          </Button>
        </div>
      </Card>

      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="ابحث باسم المؤسسة أو رمزها"
      />
      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {data.items.map((t) => {
            const pct = t.seat_quota ? Math.min(100, ((t.used ?? 0) / t.seat_quota) * 100) : 0;
            return (
              <li key={t.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-fg">{t.name}</p>
                  <p className="ltr-isolate text-xs text-fg-muted">{t.slug}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-fg">
                    {t.used === null ? '—' : formatNumber(t.used)} من {t.seat_quota === null ? 'غير محدد بعد' : formatNumber(t.seat_quota)}
                  </p>
                  {t.seat_quota !== null && <ProgressBar value={pct} variant={pct >= 100 ? 'danger' : 'primary'} />}
                </div>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(t); setQuota(String(t.seat_quota ?? t.used ?? 0)); setReason(''); }}>
                  تعديل الحد
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {data && data.lastPage > 1 && <Pagination currentPage={page} totalPages={data.lastPage} onPageChange={setPage} totalItems={data.total} pageSize={20} />}

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => !busy && setEditing(null)}
        title="تعديل حد المؤسسة"
        subtitle={editing?.name}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
              إلغاء
            </Button>
            <Button onClick={() => void saveQuota()} isLoading={busy}>
              حفظ
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="الحد الجديد (مقاعد)" inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} helperText={editing?.used !== null && editing?.used !== undefined ? `المستخدم الآن: ${formatNumber(editing.used)}` : undefined} />
          <Textarea label="السبب (يُسجَّل في سجل التدقيق)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
        </div>
      </Modal>
    </div>
  );
}
