'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/auth-context';
import { adminApi, AuditLogItem } from '../../lib/admin-api';
import { educationApi } from '../../lib/education-api';
import { billingApi, PaymentRequestItem, PackageItem } from '../../lib/billing-api';
import { attendanceApi } from '../../lib/attendance-api';
import type { Student, Course, ClassSession } from '../../types';
import { PageHeader } from '../../components/ui/page-header';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { StatCard } from '../../components/ui/stat-card';

import { UsersIcon, BookOpenIcon, CalendarIcon, CreditCardIcon, ShieldIcon, FileTextIcon, AlertCircleIcon, PlusIcon, IconNext } from '../../components/icons';

import { formatCurrency, formatNumber, formatTime } from '../../lib/format';
import { partial } from '../../lib/partial-failure';
export default function TenantAdminDashboardPage() {
  const { user, tenant } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestItem[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminDashboard = async () => {
      try {
        setLoading(true);

        const [stList, crsList, pkgList, payList, sessList, auditData] = await Promise.all([
          educationApi.getStudents().catch(partial([])),
          educationApi.getCourses().catch(partial([])),
          billingApi.getPackages().catch(partial([])),
          billingApi.getPaymentRequests().catch(partial([])),
          attendanceApi.getSessions().catch(partial([])),
          adminApi.getAuditLogs({ per_page: 6 }).catch(partial(({ audit_logs: [] }))),
        ]);

        setStudents(stList);
        setCourses(crsList);
        setPackages(pkgList);
        setPaymentRequests(payList);
        setSessions(sessList);
        setAuditLogs(auditData.audit_logs ?? []);
      } finally {
        setLoading(false);
      }
    };

    loadAdminDashboard();
  }, []);

  const pendingPayments = paymentRequests.filter((p) => p.status === 'pending');
  const approvedPayments = paymentRequests.filter((p) => p.status === 'approved');
  const totalApprovedRevenue = approvedPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const totalPendingRevenue = pendingPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const publishedCoursesCount = courses.filter((c) => c.status === 'published').length;
  const activeStudentsCount = students.filter((s) => s.status === 'active').length;

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <PageHeader
        title={`لوحة الإدارة التنفيذية — ${tenant?.name || 'الأكاديمية'}`}
        description="إدارة شؤون المنظومة الأكاديمية، متابعة التحصيلات المالية، اشتراكات الطلاب، ومراقبة سجل العمليات الإدارية."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/users/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
            >
              <PlusIcon size={14} />
              <span>إضافة مستخدم جديد</span>
            </Link>
            <Link
              href="/admin/packages"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-border bg-surface text-fg text-xs font-semibold hover:bg-surface-raised transition-colors"
            >
              <CreditCardIcon size={14} />
              <span>إدارة الباقات</span>
            </Link>
          </div>
        }
      />

      {/* Alerts Bar (Pending payments, etc.) */}
      {pendingPayments.length > 0 && (
        <div className="p-4 rounded-lg bg-amber-subtle text-amber-subtle-fg border border-amber/30 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircleIcon size={18} className="text-amber shrink-0" />
            <span>
              يوجد <strong className="font-bold font-mono">{formatNumber(pendingPayments.length)}</strong> إيصالات سداد معلقة بانتظار المراجعة والاعتماد المالي بقيمة إجمالية{' '}
              <strong className="font-bold font-mono">{formatCurrency(totalPendingRevenue)}</strong>.
            </span>
          </div>
          <Link
            href="/teacher/payments"
            className="px-3.5 py-1.5 rounded-md bg-amber text-amber-fg text-xs font-bold shrink-0 hover:opacity-90 transition-opacity"
          >
            مراجعة الإيصالات الآن
          </Link>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="الطلاب المسجلون"
          value={activeStudentsCount}
          subtitle={`إجمالي ${students.length} طالب بالمنظومة`}
          icon={<UsersIcon size={18} />}
          variant="default"
        />
        <StatCard
          title="المقررات المنشورة"
          value={publishedCoursesCount}
          subtitle={`من إجمالي ${courses.length} مقرر دراسي`}
          icon={<BookOpenIcon size={18} />}
          variant="emerald"
        />
        <StatCard
          title="الإيرادات المعتمدة"
          value={`${formatCurrency(totalApprovedRevenue)}`}
          subtitle={`${approvedPayments.length} عمليات دفع مكتملة`}
          icon={<CreditCardIcon size={18} />}
          variant="purple"
        />
        <StatCard
          title="الجلسات المجدولة"
          value={sessions.length}
          subtitle="حصص حضورية ومحاضرات"
          icon={<CalendarIcon size={18} />}
          variant="lime"
        />
      </div>

      {/* Two Column Layout: Operational Highlights + Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Quick Administration & Overview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Management Shortcuts */}
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-fg border-b border-border pb-3 flex items-center gap-2">
              <ShieldIcon size={16} className="text-primary" />
              <span>أدوات الإدارة والتهيئة السريعة</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <Link
                href="/admin/users"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>إدارة المستخدمين</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  حسابات الطلاب والمعلمين وأولياء الأمور وضبط كلمات المرور.
                </p>
              </Link>

              <Link
                href="/admin/roles"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>الأدوار والصلاحيات</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  كتالوج الصلاحيات وتخصيص مستويات الوصول ونطاقات الأمان.
                </p>
              </Link>

              <Link
                href="/admin/branches"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>الفروع والقاعات</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  مراكز التعلم والقاعات وسعات الاستيعاب وجداول الحصص.
                </p>
              </Link>

              <Link
                href="/admin/packages"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>الباقات والاشتراكات</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  خطط الأسعار ومحددات الاستحقاق وفترات التجديد.
                </p>
              </Link>

              <Link
                href="/admin/settings"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>إعدادات المؤسسة</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  الهوية البصرية والألوان والشعار ووسائل تسجيل الدخول.
                </p>
              </Link>

              <Link
                href="/admin/integrations"
                className="p-4 rounded-md bg-surface-sunken border border-border hover:border-primary/40 transition-all space-y-1.5 block group"
              >
                <div className="font-bold text-fg group-hover:text-primary transition-colors flex items-center justify-between">
                  <span>الربط والتكامل الخارجي</span>
                  <IconNext size={13} className="text-fg-muted" />
                </div>
                <p className="text-xs text-fg-muted">
                  حالة اتصال Google Workspace والبريد الإلكتروني والتخزين.
                </p>
              </Link>
            </div>
          </Card>

          {/* Packages Summary */}
          <Card className="p-6 bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <CreditCardIcon size={16} className="text-primary" />
                  <span>باقات الاشتراك الأكاديمي النشطة</span>
                </h3>
                <p className="text-xs text-fg-muted mt-0.5">
                  الباقات المتاحة للطلبة للتسجيل والاشتراك بالمقررات.
                </p>
              </div>
              <Link href="/admin/packages" className="text-xs text-primary font-semibold hover:underline">
                إدارة الباقات
              </Link>
            </div>

            {packages.length === 0 ? (
              <div className="py-6 text-center text-xs text-fg-muted">
                لا توجد باقات منشأة حتى الآن. يمكنك إنشاء أول باقة لتفعيل الاشتراكات.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {packages.slice(0, 4).map((pkg) => (
                  <div
                    key={pkg.id}
                    className="p-3.5 rounded-md bg-surface-sunken border border-border flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-fg">{pkg.name}</div>
                      <div className="text-xs text-fg-muted font-mono mt-0.5">
                        {pkg.price ? `${pkg.price} ر.س` : 'مجانية'} • {pkg.billing_cycle || 'شهري'}
                      </div>
                    </div>
                    <Badge variant={pkg.status === 'active' ? 'success' : 'neutral'}>
                      {pkg.status === 'active' ? 'نشطة' : pkg.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Column: Live Audit Activity */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                <FileTextIcon size={16} className="text-primary" />
                <span>سجل العمليات والرقابة (Audit)</span>
              </h3>
              <Link href="/admin/audit" className="text-xs text-primary font-semibold hover:underline">
                عرض الكل
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-fg-muted">جارٍ تحميل سجل العمليات...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-fg-muted">
                لا توجد سجلات تدقيق حديثة مسجلة.
              </div>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-md bg-surface-sunken border border-border text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary text-xs truncate max-w-[150px]">
                        {log.action}
                      </span>
                      <span className="text-xs text-fg-muted font-mono">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-fg-muted truncate">
                      المنفذ:{' '}
                      <strong className="text-fg font-mono">
                        {log.actor_id ? `${log.actor_id.slice(0, 8)}...` : 'النظام'}
                      </strong>
                    </div>
                    {log.ip_address && (
                      <div className="text-xs text-fg-muted font-mono">
                        IP: {log.ip_address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <Link
                href="/admin/audit"
                className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
              >
                <span>فتح مركز الرقابة وسجل التدقيق</span>
                <IconNext size={12}  />
              </Link>
            </div>
          </Card>

          {/* Security Invariant Notice */}
          <Card className="p-4 bg-surface border border-border shadow-xs text-xs space-y-2">
            <h5 className="font-bold text-fg flex items-center gap-1.5">
              <ShieldIcon size={14} className="text-primary" />
              <span>محدد الأمان §13:</span>
            </h5>
            <p className="text-fg-muted leading-relaxed text-xs">
              جميع عمليات الوصول والتعديل على بيانات المستأجر والطلاب يتم تسجيلها بشكل غير قابل للتعديل (Append-Only) لضمان الامتثال والمساءلة.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
