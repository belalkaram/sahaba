'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { ApiError } from '../../../lib/api-client';
import { formatDateTime } from '../../../lib/format';
import { platformApi, type DriveAccount, type DriveAccountsResponse } from '../../../lib/platform-api';

const STATUS: Record<DriveAccount['status'], { label: string; variant: 'success' | 'danger' | 'neutral' }> = {
  connected: { label: 'مرتبط', variant: 'success' },
  error: { label: 'يحتاج إعادة ربط', variant: 'danger' },
  disabled: { label: 'مفصول', variant: 'neutral' },
};

const CALLBACK: Record<string, string> = {
  connected: 'تمت إضافة حساب Google Drive.',
  denied: 'لم تتم الموافقة في صفحة Google.',
  state: 'انتهت صلاحية طلب الربط. أعد المحاولة.',
  exchange: 'تعذّر إتمام الربط مع Google.',
};

function bytes(n: number | null): string {
  if (n === null) return 'غير محدود';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Reads ?google=… left by the OAuth callback redirect, then clears it from the address bar. */
function readCallback(): { ok: boolean; text: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const result = params.get('google');
  if (!result) return null;
  window.history.replaceState(null, '', window.location.pathname);
  const key = result === 'connected' ? 'connected' : params.get('reason') ?? 'exchange';
  return { ok: result === 'connected', text: CALLBACK[key] ?? CALLBACK.exchange };
}

/**
 * ADR-009 — the Google accounts that store academies' videos. Uploads go to the first account (by order) that has
 * room for the file plus the safety margin; academies with their own Google connection keep using it.
 */
export default function PlatformStoragePage() {
  const [data, setData] = useState<DriveAccountsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<DriveAccount | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setData(await platformApi.getDriveAccounts());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    setNotice(readCallback());
    void load();
  }, [load]);

  const replace = (account: DriveAccount) =>
    setData((d) => (d ? { ...d, accounts: d.accounts.map((a) => (a.id === account.id ? account : a)) } : d));

  const run = async (id: string, action: () => Promise<DriveAccount>, okText?: string) => {
    setBusyId(id);
    try {
      replace(await action());
      if (okText) setNotice({ ok: true, text: okText });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof ApiError ? err.message : 'تعذّر تنفيذ العملية.' });
    } finally {
      setBusyId(null);
    }
  };

  const connect = async () => {
    setBusyId('connect');
    try {
      window.location.assign(await platformApi.driveAccountConnectUrl());
    } catch (err) {
      setBusyId(null);
      setNotice({ ok: false, text: err instanceof ApiError && err.code === 'GOOGLE_NOT_CONFIGURED' ? 'بيانات Google غير مضبوطة على الخادم.' : 'تعذّر بدء الربط.' });
    }
  };

  const move = (account: DriveAccount, direction: -1 | 1) => {
    if (!data) return;
    const sorted = [...data.accounts];
    const index = sorted.findIndex((a) => a.id === account.id);
    const other = sorted[index + direction];
    if (!other) return;
    // Swap the two priorities (equal ones get pushed apart so the order is stable).
    const mine = other.priority === account.priority ? account.priority + direction : other.priority;
    void run(account.id, async () => {
      await platformApi.updateDriveAccount(other.id, { priority: account.priority });
      const updated = await platformApi.updateDriveAccount(account.id, { priority: mine });
      await load();
      return updated;
    });
  };

  const totals = data?.accounts.filter((a) => a.status === 'connected').reduce(
    (t, a) => ({
      free: t.free === null || a.free_bytes === null ? null : t.free + a.free_bytes,
      used: t.used + a.quota_usage_bytes,
    }),
    { free: 0 as number | null, used: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="تخزين الفيديوهات"
        description="حسابات Google Drive التي تُرفع عليها فيديوهات المؤسسات غير المرتبطة بحساب Google خاص بها."
        breadcrumbs={[{ label: 'لوحة المنصة', href: '/platform/dashboard' }, { label: 'تخزين الفيديوهات' }]}
        actions={
          <Button onClick={connect} isLoading={busyId === 'connect'} disabled={data?.configured === false} icon={<Plus size={16} aria-hidden />}>
            إضافة حساب Google Drive
          </Button>
        }
      />

      {notice && (
        <p role="status" className={`rounded-md border p-3 text-sm font-semibold ${notice.ok ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
          {notice.text}
        </p>
      )}

      {data?.configured === false && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-fg">بيانات Google (Client ID / Secret) غير مضبوطة على الخادم.</p>
      )}

      {failed ? (
        <ErrorState onRetry={load} />
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : data.accounts.length === 0 ? (
        <EmptyState
          icon={<HardDrive size={28} aria-hidden />}
          title="لا توجد حسابات تخزين بعد"
          description="أضف حساب Google Drive (مثل Google One) ليستخدمه رفع الفيديوهات."
        />
      ) : (
        <>
          <Card className="flex flex-wrap gap-6 text-sm">
            <span>المساحة الحرة الإجمالية: <strong>{bytes(totals?.free ?? 0)}</strong></span>
            <span>المستخدم: <strong>{bytes(totals?.used ?? 0)}</strong></span>
            <span className="text-fg-muted">هامش الأمان لكل رفع: {bytes(data.margin_bytes)}</span>
          </Card>

          <ol className="space-y-3">
            {data.accounts.map((account, index) => {
              const status = STATUS[account.status];
              const usedPercent = account.quota_limit_bytes ? Math.round(((account.quota_usage_bytes + account.reserved_bytes) / account.quota_limit_bytes) * 100) : 0;
              const busy = busyId === account.id;
              return (
                <li key={account.id}>
                  <Card className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted text-sm font-bold text-fg-muted">{index + 1}</span>
                        <div>
                          <p dir="ltr" className="text-sm font-bold text-fg">{account.account_email}</p>
                          <p className="text-xs text-fg-muted">
                            {account.quota_checked_at ? `آخر قراءة للمساحة: ${formatDateTime(account.quota_checked_at)}` : 'لم تُقرأ المساحة بعد'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={status.variant} size="sm">{status.label}</Badge>
                        {account.status === 'connected' && !account.accepting_uploads && <Badge variant="warning" size="sm">الرفع موقوف</Badge>}
                      </div>
                    </div>

                    {account.quota_limit_bytes !== null && <ProgressBar value={usedPercent} variant={usedPercent > 90 ? 'danger' : usedPercent > 75 ? 'warning' : 'primary'} />}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-muted">
                      <span>السعة: {bytes(account.quota_limit_bytes)}</span>
                      <span>المستخدم: {bytes(account.quota_usage_bytes)}</span>
                      <span>محجوز لرفع جارٍ: {bytes(account.reserved_bytes)}</span>
                      <span className="font-semibold text-fg">الحر: {bytes(account.free_bytes)}</span>
                    </div>
                    {account.last_error && <p className="text-xs text-danger">آخر خطأ: {account.last_error}</p>}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
                      <Switch
                        checked={account.accepting_uploads}
                        disabled={busy || account.status !== 'connected'}
                        onChange={(checked) => void run(account.id, () => platformApi.updateDriveAccount(account.id, { accepting_uploads: checked }))}
                        label="يستقبل رفعاً جديداً"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={busy || index === 0} onClick={() => move(account, -1)}>تقديم</Button>
                        <Button size="sm" variant="outline" disabled={busy || index === data.accounts.length - 1} onClick={() => move(account, 1)}>تأخير</Button>
                        <Button size="sm" variant="outline" disabled={busy || account.status !== 'connected'} icon={<RefreshCw size={14} aria-hidden />}
                          onClick={() => void run(account.id, () => platformApi.refreshDriveQuota(account.id), 'تم تحديث المساحة.')}>
                          تحديث المساحة
                        </Button>
                        {account.status !== 'connected' ? (
                          <Button size="sm" onClick={connect}>إعادة الربط</Button>
                        ) : (
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => setDisconnecting(account)}>فصل</Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <ConfirmDialog
        isOpen={disconnecting !== null}
        onClose={() => setDisconnecting(null)}
        onConfirm={async () => {
          const account = disconnecting;
          setDisconnecting(null);
          if (account) await run(account.id, () => platformApi.disconnectDriveAccount(account.id), 'تم فصل الحساب.');
        }}
        title="فصل حساب التخزين؟"
        description="لن يُرفع عليه أي فيديو جديد. الفيديوهات الموجودة تبقى في Drive وتستمر في العمل لأنها مشاركة بالرابط."
        confirmText="فصل"
        isDestructive
      />
    </div>
  );
}
