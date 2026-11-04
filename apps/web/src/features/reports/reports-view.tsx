'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileBarChart, Printer } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge, type BadgeVariant } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Drawer } from '../../components/ui/drawer';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { TableSkeleton } from '../../components/ui/skeleton';
import { reportApi, type ReportFormat, type ReportItem, type ReportType } from '../../lib/report-api';
import { ApiError } from '../../lib/api-client';
import { formatDateTime, formatDual } from '../../lib/format';

export interface ReportTarget {
  value: string;
  label: string;
}

export interface ReportTypeOption {
  type: ReportType;
  label: string;
  /** The parameter this report needs, with its choices; omitted for tenant-wide reports. */
  parameter?: { key: 'student_id' | 'class_id' | 'course_id'; label: string; options: ReportTarget[] };
}

const STATUS: Record<ReportItem['status'], { label: string; variant: BadgeVariant }> = {
  queued: { label: 'في الانتظار', variant: 'neutral' },
  processing: { label: 'قيد الإعداد', variant: 'info' },
  completed: { label: 'جاهز', variant: 'success' },
  failed: { label: 'فشل', variant: 'danger' },
};

const POLL_MS = 3000;

/** Request reports (queued on the server), follow their status, download or print them. */
export function ReportsView({ types }: { types: ReportTypeOption[] }) {
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState<ReportType | ''>(types[0]?.type ?? '');
  const [target, setTarget] = useState('');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ReportItem | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const option = types.find((t) => t.type === type);

  const load = useCallback(async () => {
    try {
      setReports(await reportApi.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll only while something is still being generated.
  useEffect(() => {
    const pending = reports?.some((r) => r.status === 'queued' || r.status === 'processing');
    if (!pending) return;
    pollRef.current = window.setTimeout(load, POLL_MS);
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [reports, load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    if (option?.parameter && !target) {
      setFormError(`اختر ${option.parameter.label}.`);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await reportApi.create({
        title: title.trim() || option?.label || 'تقرير',
        type,
        format,
        parameters: option?.parameter ? { [option.parameter.key]: target } : undefined,
      });
      setTitle('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError && err.status === 403 ? 'ليست لديك صلاحية إنشاء هذا التقرير.' : 'تعذّر طلب التقرير.');
    } finally {
      setSubmitting(false);
    }
  };

  const openPreview = async (report: ReportItem) => {
    setPreview(await reportApi.get(report.id));
  };

  const download = async (report: ReportItem) => {
    setDownloadError(null);
    try {
      await reportApi.downloadFile(report);
    } catch {
      setDownloadError('تعذّر تنزيل الملف.');
    }
  };

  if (failed) return <ErrorState onRetry={load} />;

  const payload = preview?.data_payload;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="طلب تقرير جديد" description="يُعدّ التقرير في الخلفية ويظهر هنا عند اكتماله." />
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Select
            label="نوع التقرير"
            value={type}
            onChange={(e) => {
              setType(e.target.value as ReportType);
              setTarget('');
            }}
            options={types.map((t) => ({ value: t.type, label: t.label }))}
          />
          {option?.parameter && (
            <Select
              label={option.parameter.label}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              options={[{ value: '', label: 'اختر…' }, ...option.parameter.options]}
            />
          )}
          <Select
            label="الصيغة"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            options={[
              { value: 'csv', label: 'ملف CSV (Excel)' },
              { value: 'json', label: 'عرض وطباعة فقط' },
            ]}
          />
          <Input label="العنوان (اختياري)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="md:col-span-2 lg:col-span-4">
            {formError && (
              <p role="alert" className="mb-3 text-sm text-danger">
                {formError}
              </p>
            )}
            <Button type="submit" isLoading={submitting} disabled={!type}>
              طلب التقرير
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="none">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-fg">التقارير</h2>
        </div>
        {!reports ? (
          <div className="p-5">
            <TableSkeleton rows={3} cols={3} />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-5">
            <EmptyState compact icon={<FileBarChart size={24} strokeWidth={1.75} aria-hidden />} title="لا توجد تقارير" description="اطلب أول تقرير من النموذج أعلاه." />
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{report.title}</p>
                  <p className="text-xs text-fg-muted">{formatDateTime(report.created_at)}</p>
                  {report.status === 'failed' && <p className="mt-1 text-xs text-danger">تعذّر إعداد التقرير. اطلبه مرة أخرى.</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant={STATUS[report.status].variant} size="sm">
                    {STATUS[report.status].label}
                  </Badge>
                  {report.status === 'completed' && (
                    <Button size="sm" variant="secondary" icon={<Printer size={14} aria-hidden />} onClick={() => openPreview(report)}>
                      عرض وطباعة
                    </Button>
                  )}
                  {report.status === 'completed' && report.format === 'csv' && (
                    <Button size="sm" variant="secondary" icon={<Download size={14} aria-hidden />} onClick={() => download(report)}>
                      تنزيل
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {downloadError && (
          <p role="alert" className="border-t border-border px-5 py-3 text-sm text-danger">
            {downloadError}
          </p>
        )}
      </Card>

      <Drawer
        isOpen={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ''}
        subtitle={payload?.generated_at ? formatDual(payload.generated_at) : undefined}
        width="xl"
        footer={
          <Button variant="secondary" icon={<Printer size={16} aria-hidden />} onClick={() => window.print()}>
            طباعة / حفظ PDF
          </Button>
        }
      >
        {payload && (
          <div className="space-y-5" data-print-area>
            {payload.summary && (
              <dl className="grid gap-3 sm:grid-cols-2">
                {payload.summary.map((item) => (
                  <div key={item.label} className="rounded-md bg-surface-muted p-3">
                    <dt className="text-xs text-fg-muted">{item.label}</dt>
                    <dd className="mt-0.5 text-sm font-bold text-fg tabular">{item.value ?? 'لا توجد بيانات'}</dd>
                  </div>
                ))}
              </dl>
            )}
            {payload.columns && payload.rows && payload.rows.length > 0 ? (
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {payload.columns.map((c) => (
                        <th key={c.key} className="px-2 py-2 text-start text-xs font-semibold text-fg-muted">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {payload.rows.map((row, i) => (
                      <tr key={i}>
                        {payload.columns!.map((c) => (
                          <td key={c.key} className="px-2 py-2 text-fg">
                            {row[c.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">لا توجد صفوف في هذا التقرير.</p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
