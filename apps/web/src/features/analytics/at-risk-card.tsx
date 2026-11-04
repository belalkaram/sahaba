'use client';

import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { ApiError, apiClient } from '../../lib/api-client';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format';

interface AtRiskStudent {
  student_id: string;
  name: string | null;
  attendance_rate: number | null;
  overall_score: number | null;
  last_activity_at: string | null;
}

interface AtRiskResponse {
  thresholds: { attendance_below: number; score_below: number };
  students: AtRiskStudent[];
}

/** R8-4 — students below the tenant thresholds, within the viewer's scope. */
export function AtRiskCard() {
  const [data, setData] = useState<AtRiskResponse | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading');

  useEffect(() => {
    apiClient
      .get<AtRiskResponse>('/analytics/at-risk')
      .then((res) => {
        setData(res.data);
        setState('ready');
      })
      .catch((err) => setState(err instanceof ApiError && err.status === 403 ? 'hidden' : 'error'));
  }, []);

  if (state === 'hidden') return null;

  return (
    <Card>
      <CardHeader
        icon={<TriangleAlert size={20} strokeWidth={1.75} aria-hidden />}
        title="طلاب بحاجة إلى متابعة"
        description={
          data
            ? `حضور أقل من ${formatPercent(data.thresholds.attendance_below)} أو معدل أقل من ${formatPercent(data.thresholds.score_below)}`
            : undefined
        }
      />
      {state === 'loading' && <Skeleton className="h-24 w-full" />}
      {state === 'error' && <p className="text-sm text-danger">تعذّر تحميل القائمة.</p>}
      {state === 'ready' && data?.students.length === 0 && <p className="text-sm text-fg-muted">لا يوجد طلاب تحت الحدود المحددة حالياً.</p>}
      {state === 'ready' && !!data?.students.length && (
        <div tabIndex={0} className="overflow-x-auto">
          <p className="mb-2 text-xs text-fg-subtle">{formatNumber(data.students.length)} طالب</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-fg-muted">
                <th className="py-2 text-start font-semibold">الطالب</th>
                <th className="py-2 text-start font-semibold">الحضور</th>
                <th className="py-2 text-start font-semibold">المعدل</th>
                <th className="py-2 text-start font-semibold">آخر نشاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {data.students.map((s) => (
                <tr key={s.student_id}>
                  <td className="py-2 font-medium text-fg">{s.name ?? '—'}</td>
                  <td className="py-2 text-fg-muted">{formatPercent(s.attendance_rate)}</td>
                  <td className="py-2 text-fg-muted">{formatPercent(s.overall_score)}</td>
                  <td className="py-2 text-fg-muted">{s.last_activity_at ? formatRelative(s.last_activity_at) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
