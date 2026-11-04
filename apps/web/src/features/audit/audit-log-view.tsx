'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { History, Search } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Drawer } from '../../components/ui/drawer';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Forbidden } from '../../components/ui/forbidden';
import { Pagination } from '../../components/ui/pagination';
import { TableSkeleton } from '../../components/ui/skeleton';
import { ApiError } from '../../lib/api-client';
import { formatDateTime, formatDual, formatNumber } from '../../lib/format';

export interface AuditRow {
  id: string | number;
  action: string;
  actor_type?: string | null;
  actor_email?: string | null;
  actor_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditPage {
  audit_logs: AuditRow[];
  pagination: { current_page: number; last_page?: number; per_page: number; total: number };
}

const ACTOR_LABELS: Record<string, string> = {
  user: 'مستخدم',
  TenantUser: 'مستخدم',
  system: 'النظام',
  public: 'زائر',
  support: 'دعم فني',
  platform_admin: 'مشرف المنصة',
  platform_user: 'مشرف المنصة',
  platform_token: 'مشرف المنصة',
};

type LoadState = 'loading' | 'ready' | 'forbidden' | 'error';

/** Filterable audit log table with a detail drawer; shared by tenant and platform consoles. */
export function AuditLogView({ load }: { load: (params: { action?: string; page: number; per_page: number }) => Promise<AuditPage> }) {
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<AuditPage | null>(null);
  const [action, setAction] = useState('');
  const [appliedAction, setAppliedAction] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const fetchPage = useCallback(async () => {
    setState('loading');
    try {
      setData(await load({ action: appliedAction || undefined, page, per_page: 25 }));
      setState('ready');
    } catch (err) {
      setState(err instanceof ApiError && err.status === 403 ? 'forbidden' : 'error');
    }
  }, [load, appliedAction, page]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (state === 'forbidden') return <Forbidden description="ليست لديك صلاحية عرض سجل التدقيق." />;
  if (state === 'error') return <ErrorState onRetry={fetchPage} />;

  const rows = data?.audit_logs ?? [];
  const totalPages = data?.pagination.last_page ?? Math.max(1, Math.ceil((data?.pagination.total ?? 0) / (data?.pagination.per_page ?? 25)));

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedAction(action.trim());
        }}
      >
        <div className="w-full sm:max-w-sm">
          <Input
            label="نوع الإجراء"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="مثال: tenant.updated"
            dir="ltr"
            iconPrefix={<Search size={16} strokeWidth={1.75} aria-hidden />}
          />
        </div>
        <Button type="submit" variant="secondary">
          تطبيق
        </Button>
      </form>

      {state === 'loading' ? (
        <Card>
          <TableSkeleton rows={6} cols={4} />
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History size={24} strokeWidth={1.75} aria-hidden />}
          title="لا توجد سجلات"
          description={appliedAction ? 'لا توجد إجراءات تطابق هذا البحث.' : 'ستظهر هنا الإجراءات الحساسة فور حدوثها.'}
        />
      ) : (
        <Card padding="none" className="overflow-x-auto" tabIndex={0}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-fg-muted">
                <th className="px-4 py-3 text-start font-semibold">الإجراء</th>
                <th className="px-4 py-3 text-start font-semibold">المنفّذ</th>
                <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">الكيان</th>
                <th className="px-4 py-3 text-start font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr key={row.id} onClick={() => setSelected(row)} className="cursor-pointer transition-colors hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <span className="ltr-isolate font-semibold text-fg">{row.action}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge size="sm">{ACTOR_LABELS[row.actor_type ?? ''] ?? row.actor_type ?? '—'}</Badge>
                    {row.actor_email && <span className="ltr-isolate ms-2 hidden text-xs text-fg-muted lg:inline">{row.actor_email}</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-fg-muted md:table-cell">
                    <span className="ltr-isolate">{row.entity_type ?? '—'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-fg-muted">{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
      {data && <p className="text-xs text-fg-subtle">إجمالي السجلات: {formatNumber(data.pagination.total)}</p>}

      <Drawer isOpen={!!selected} onClose={() => setSelected(null)} title="تفاصيل السجل" subtitle={selected ? formatDual(selected.created_at) : undefined} width="lg">
        {selected && (
          <dl className="space-y-3 text-sm">
            {(
              [
                ['الإجراء', selected.action],
                ['المنفّذ', selected.actor_email ?? selected.actor_id ?? '—'],
                ['نوع الكيان', selected.entity_type ?? '—'],
                ['معرّف الكيان', selected.entity_id ?? '—'],
                ['عنوان IP', selected.ip_address ?? '—'],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-border-subtle pb-2">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="ltr-isolate break-all font-medium text-fg">{value}</dd>
              </div>
            ))}
            {selected.payload && (
              <div>
                <dt className="mb-1 text-fg-muted">البيانات</dt>
                <dd>
                  <pre dir="ltr" className="overflow-x-auto rounded-md bg-surface-muted p-3 text-xs text-fg">
                    {JSON.stringify(selected.payload, null, 2)}
                  </pre>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Drawer>
    </div>
  );
}
