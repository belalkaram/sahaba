'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type { RegistrationRequestItem } from '../../lib/admin-api';
import { Badge } from '../../components/ui/badge';
import { formatDateTime, formatNumber } from '../../lib/format';

const STATUS = {
  pending: { label: 'بانتظار القرار', variant: 'warning' },
  approved: { label: 'مقبول', variant: 'success' },
  rejected: { label: 'مرفوض', variant: 'danger' },
} as const;

function Info({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className={ltr ? 'ltr-isolate break-all text-sm font-semibold text-fg' : 'break-words text-sm font-semibold text-fg'}>{value || '—'}</dd>
    </div>
  );
}

export function RequestCard({ item, busy, onApprove, onReject }: { item: RegistrationRequestItem; busy: boolean; onApprove: () => void; onReject: () => void }) {
  const status = STATUS[item.status];
  return (
    <article className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-lg font-bold text-fg">{item.full_name}</h3>
          <p className="text-sm text-fg-muted">{item.grade_label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="ltr-isolate rounded-md bg-surface-muted px-2 py-1 font-mono text-xs font-bold text-fg">{item.reference_code}</span>
        </div>
      </header>

      {item.duplicate_count > 0 && (
        <p className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-fg">
          <TriangleAlert size={16} aria-hidden /> يوجد {formatNumber(item.duplicate_count)} طلب آخر بنفس رقم الهوية.
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="رقم الهوية" value={item.national_id_masked} ltr />
        <Info label="جوال الطالب" value={item.student_phone} ltr />
        <Info label="البريد" value={item.email} ltr />
        <Info label="المنطقة" value={item.region} />
        <Info label="المحافظة / المدينة" value={item.governorate} />
        <Info label="العنوان" value={item.address} />
        <Info label="ولي الأمر" value={item.guardian_name} />
        <Info label="جوال ولي الأمر" value={item.guardian_phone} ltr />
        <Info label="مهنة ولي الأمر" value={item.guardian_occupation} />
      </dl>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-fg-muted">
          {item.created_at ? `قُدِّم ${formatDateTime(item.created_at)}` : ''}
          {item.decision_note ? ` — ملاحظة: ${item.decision_note}` : ''}
        </p>
        {item.status === 'pending' && (
          <div className="flex gap-2">
            <button type="button" onClick={onReject} disabled={busy} className="rounded-md border border-danger/30 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-subtle disabled:opacity-50">
              رفض
            </button>
            <button type="button" onClick={onApprove} disabled={busy} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-50">
              قبول وإنشاء الحساب
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}
