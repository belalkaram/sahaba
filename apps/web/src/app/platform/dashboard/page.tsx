'use client';

/**
 * R2-6 — Platform Dashboard
 * Real platform KPIs from GET /platform/metrics and /health.
 * Zero fake fallback, displays actual aggregate counts.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircleIcon, ShieldIcon, UsersIcon, BookOpenIcon } from '../../../components/icons';
import { platformApi, PlatformMetricsResponse } from '../../../lib/platform-api';
import { apiClient } from '../../../lib/api-client';
import { DataState } from '../../../components/ui/data-state';

import { IconNext } from '../../../components/icons/directional';
import { formatNumber, formatRelative } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { partial } from '../../../lib/partial-failure';
interface HealthData {
  status: string;
  services: {
    database: string;
    cache: string;
  };
  version: string;
  environment: string;
}

export default function PlatformDashboardPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthRes, metricsData] = await Promise.all([
        apiClient.get<HealthData>('/health').catch(partial(null)),
        platformApi.getMetrics().catch((e) => {
          throw new Error(e?.message || 'تعذر جلب إحصائيات المنصة. تأكد من صلاحية حساب المدير.');
        }),
      ]);

      if (healthRes) {
        setHealth(healthRes.data);
      }
      setMetrics(metricsData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ في تحميل البيانات';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <DataState state="loading" message="جاري تحميل مؤشرات المنصة المركزية..." />;
  if (error) return <DataState state="error" message={error} onRetry={loadData} />;

  const summary = metrics?.summary;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-sidebar text-fg shadow-xl flex flex-col sadu">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 md:p-8 flex-1">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--acc)_20%,transparent)] text-accent px-2.5 py-0.5 text-xs font-semibold">
                الإدارة العليا للمنصة (Platform Control Plane)
              </span>
              <span className="text-xs text-fg-muted font-mono">v1.0.0 (Production Core)</span>
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-bold text-fg tracking-tight">
              لوحة التحكم المركزية للمنصة
            </h1>
            <p className="mt-2 text-sm text-fg-muted max-w-xl leading-relaxed">
              مراقبة صحة النظام، عزل قواعد البيانات للمستأجرين، إدارة تراخيص المدارس والأكاديميات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/platform/tenants">
              <button className="flex items-center justify-center gap-2 rounded-lg bg-accent text-accent-foreground px-5 py-2.5 font-bold text-sm hover:opacity-90 transition-opacity shadow-lg shadow-accent/30">
                <ShieldIcon size={16} />
                إدارة المؤسسات والمدارس
              </button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-fg-muted">
          <span>
            آخر حساب للإحصائيات: <strong className="text-fg">{summary?.computed_at ? formatRelative(summary.computed_at) : 'لم يُحسب بعد'}</strong>
          </span>
          <span>
            مهام الطابور المعلّقة: <strong className="text-fg">{formatNumber(metrics?.queue?.pending)}</strong>
          </span>
          <span>
            المهام الفاشلة: <strong className={metrics?.queue?.failed ? 'text-danger' : 'text-fg'}>{formatNumber(metrics?.queue?.failed)}</strong>
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isLoading={refreshing}
          onClick={async () => {
            setRefreshing(true);
            try {
              setMetrics(await platformApi.refreshMetrics());
            } catch {
              setError('تعذّر تحديث الإحصائيات.');
            } finally {
              setRefreshing(false);
            }
          }}
        >
          تحديث الإحصائيات الآن
        </Button>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--tq)_5%,transparent)] border border-turquoise/20 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-secondary">حالة السيرفر الأساسي</p>
            <h3 className="text-xl font-bold text-turquoise mt-1 uppercase">
              {health?.status ?? 'غير معروف'}
            </h3>
            <span className="text-xs text-turquoise/80 flex items-center gap-1 mt-1 font-semibold">
              <CheckCircleIcon size={12} /> {health ? (health.status === 'healthy' ? 'يعمل بشكل سليم' : 'يحتاج إلى فحص') : 'تعذّر الفحص'}
            </span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--tq)_15%,transparent)] text-turquoise">
            <CheckCircleIcon size={24} />
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-secondary">إجمالي المدارس والمؤسسات</p>
            <h3 className="text-xl font-bold text-foreground mt-1 uppercase">
              {formatNumber(summary?.total_tenants ?? 0)}
            </h3>
            <span className="text-xs text-primary flex items-center gap-1 mt-1 font-semibold">
              {formatNumber(summary?.active_tenants ?? 0)} نشطة — {formatNumber(summary?.suspended_tenants ?? 0)} موقوفة
            </span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--pri)_10%,transparent)] text-primary">
            <ShieldIcon size={24} />
          </div>
        </div>

        <div className="rounded-xl bg-card border border-border p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-secondary">إجمالي الطلاب المسجلين</p>
            <h3 className="text-xl font-bold text-foreground mt-1 uppercase">
              {summary?.total_students == null ? 'لم يُحسب بعد' : `${formatNumber(summary.total_students)} طالب`}
            </h3>
            <span className="text-xs text-secondary mt-1 block font-semibold">
              عبر جميع المؤسسات
            </span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--secondary)_10%,transparent)] text-secondary">
            <UsersIcon size={24} />
          </div>
        </div>

        <div className="rounded-xl bg-[color-mix(in_srgb,var(--acc)_5%,transparent)] border border-accent/20 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-secondary">إجمالي المعلمين والمقررات</p>
            <h3 className="text-xl font-bold text-accent mt-1 uppercase">
              {summary?.total_staff == null ? 'لم يُحسب بعد' : `${formatNumber(summary.total_staff)} كادر / ${formatNumber(summary.total_courses)} مقرر`}
            </h3>
            <span className="text-xs text-accent/80 mt-1 block font-semibold">
              قيد التشغيل السحابي
            </span>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--acc)_15%,transparent)] text-accent">
            <BookOpenIcon size={24} />
          </div>
        </div>
      </div>

      {/* Tenants Summary Table */}
      <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">المؤسسات التعليمية المسجلة</h2>
            <p className="text-xs text-secondary">إحصائيات مباشرة من قواعد البيانات المعزولة</p>
          </div>
          <Link href="/platform/tenants" className="text-xs text-primary font-bold hover:underline">
            
 عرض وإدارة المؤسسات <IconNext size={16} />
 </Link>
        </div>

        <div tabIndex={0} className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead>
              <tr className="border-b border-border/80 text-secondary">
                <th className="py-3 px-4">المؤسسة</th>
                <th className="py-3 px-4">المعرف (Slug)</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الطلاب</th>
                <th className="py-3 px-4">المعلمين</th>
                <th className="py-3 px-4">المقررات</th>
                <th className="py-3 px-4">حجم البيانات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {(metrics?.tenants ?? []).map((t) => (
                <tr key={t.tenant_id} className="hover:bg-background/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-foreground">{t.name}</td>
                  <td className="py-3 px-4 font-mono text-secondary">{t.slug}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                        t.status === 'active'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {t.status === 'active' ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold">{formatNumber(t.students_count)}</td>
                  <td className="py-3 px-4 font-semibold">{formatNumber(t.staff_count)}</td>
                  <td className="py-3 px-4 font-semibold">{formatNumber(t.courses_count)}</td>
                  <td className="py-3 px-4 font-mono text-secondary">
                    {t.storage_bytes ? `${formatNumber(Math.round(t.storage_bytes / 1024))} KB` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
