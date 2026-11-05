'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  platformApi,
  PlatformPaymentItem,
  PlatformPaymentMetrics,
} from '../../../lib/platform-api';
import type { Tenant } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { PageHeader } from '../../../components/ui/page-header';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { Drawer } from '../../../components/ui/drawer';
import { formatDate, formatDateTime, formatNumber } from '../../../lib/format';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  FileText,
  Building,
  Check,
  X,
  Eye,
} from 'lucide-react';

export default function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<PlatformPaymentItem[]>([]);
  const [metrics, setMetrics] = useState<PlatformPaymentMetrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals & Drawers
  const [inspectingPayment, setInspectingPayment] = useState<PlatformPaymentItem | null>(null);
  const [previewProofPayment, setPreviewProofPayment] = useState<PlatformPaymentItem | null>(null);
  const [approvingPayment, setApprovingPayment] = useState<PlatformPaymentItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const [rejectingPayment, setRejectingPayment] = useState<PlatformPaymentItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentsRes, tenantsRes] = await Promise.all([
        platformApi.getPayments({
          tenant_id: tenantFilter !== 'all' ? tenantFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          period_month: periodFilter || undefined,
          search: search.trim() || undefined,
          page,
          per_page: 25,
        }),
        platformApi.getTenants().catch(() => [] as Tenant[]),
      ]);

      setPayments(paymentsRes.payment_requests);
      setMetrics(paymentsRes.metrics);
      setTotalPages(paymentsRes.pagination.last_page);
      if (tenantsRes.length > 0) {
        setTenants(tenantsRes);
      }
    } catch {
      setFeedback({ type: 'error', text: 'فشل في تحميل سجل المدفوعات من الخادم.' });
    } finally {
      setLoading(false);
    }
  }, [tenantFilter, statusFilter, periodFilter, search, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (!approvingPayment) return;
    try {
      setIsApproving(true);
      await platformApi.approvePayment(approvingPayment.tenant.id, approvingPayment.id, {
        notes: approvalNotes.trim() || undefined,
      });
      setFeedback({
        type: 'success',
        text: `تم اعتماد التحويل للطالب وتفعيل اشتراك الشهر بنجاح.`,
      });
      setApprovingPayment(null);
      setApprovalNotes('');
      if (inspectingPayment?.id === approvingPayment.id) {
        setInspectingPayment(null);
      }
      await loadData();
    } catch {
      setFeedback({ type: 'error', text: 'تعذر اعتماد التحويل. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingPayment) return;
    if (!rejectionReason.trim()) {
      setFeedback({ type: 'error', text: 'يجب كتابة سبب الرفض لتوضيحه للطالب وولي الأمر.' });
      return;
    }

    try {
      setIsRejecting(true);
      await platformApi.rejectPayment(rejectingPayment.tenant.id, rejectingPayment.id, {
        reason: rejectionReason.trim(),
      });
      setFeedback({
        type: 'success',
        text: 'تم رفض طلب السداد وإشعار الطالب وولي الأمر بالسبب.',
      });
      setRejectingPayment(null);
      setRejectionReason('');
      if (inspectingPayment?.id === rejectingPayment.id) {
        setInspectingPayment(null);
      }
      await loadData();
    } catch {
      setFeedback({ type: 'error', text: 'تعذر رفض الطلب. يرجى المحاولة لاحقاً.' });
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">معتمد ومفعّل</Badge>;
      case 'rejected':
        return <Badge variant="danger">مرفوض</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">قيد التدقيق</Badge>;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return 'تحويل بنكي يدوي';
      case 'instapay':
        return 'InstaPay';
      case 'cash':
        return 'نقداً';
      default:
        return method || 'تحويل';
    }
  };

  return (
    <div className="space-y-6 pb-12 text-start">
      {/* Header */}
      <PageHeader
        title="مراجعة واعتماد مدفوعات الطلاب (OD-27)"
        subtitle="الصندوق المركزي لمراجعة إيصالات التحويل البنكي وتأكيد الاشتراكات الشهرية وتفعيل الوصول الأكاديمي."
        actions={
          <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={`me-1.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </Button>
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-md border flex items-center justify-between text-xs sm:text-sm ${
            feedback.type === 'success'
              ? 'border-success/30 bg-success-subtle text-success'
              : 'border-danger/30 bg-danger-subtle text-danger'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <Check size={16} /> : <X size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-fg-muted hover:text-fg text-xs"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1 bg-surface border-border">
          <div className="flex items-center justify-between text-fg-muted">
            <span className="text-xs font-medium">إجمالي الطلبات</span>
            <FileText size={16} />
          </div>
          <div className="text-2xl font-bold text-fg font-mono">
            {formatNumber(metrics?.total_requests ?? 0)}
          </div>
          <div className="text-xs text-fg-muted">عبر جميع المشتركين</div>
        </Card>

        <Card className="p-4 space-y-1 bg-surface border-warning/30 bg-warning-subtle/20">
          <div className="flex items-center justify-between text-warning">
            <span className="text-xs font-semibold">بانتظار المراجعة</span>
            <Clock size={16} />
          </div>
          <div className="text-2xl font-bold text-warning font-mono">
            {formatNumber(metrics?.pending_count ?? 0)}
          </div>
          <div className="text-xs text-warning">تتطلب تدقيق وموافقة فورية</div>
        </Card>

        <Card className="p-4 space-y-1 bg-surface border-border">
          <div className="flex items-center justify-between text-success">
            <span className="text-xs font-medium">معتمدة ومفعلة</span>
            <CheckCircle size={16} />
          </div>
          <div className="text-2xl font-bold text-success font-mono">
            {formatNumber(metrics?.approved_count ?? 0)}
          </div>
          <div className="text-xs text-fg-muted">اشتراكات شهرية نشطة</div>
        </Card>

        <Card className="p-4 space-y-1 bg-surface border-border">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-medium">إجمالي التحصيل</span>
            <CreditCard size={16} />
          </div>
          <div className="text-2xl font-bold text-primary font-mono">
            {formatNumber(metrics?.total_amount_collected ?? 0)} ر.س
          </div>
          <div className="text-xs text-fg-muted">رسوم الطلاب الشهرية (10 ر.س)</div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-surface border-border space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
            <Input
              type="text"
              placeholder="بحث باسم الطالب، الهاتف، أو المرجع..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="ps-9 text-xs"
            />
          </div>

          {/* Tenant Selector */}
          <div>
            <Select
              value={tenantFilter}
              onChange={(e) => {
                setTenantFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="all">جميع المشتركين والمؤسسات</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="all">جميع الحالات</option>
              <option value="pending">قيد التدقيق فقط</option>
              <option value="approved">معتمدة فقط</option>
              <option value="rejected">مرفوضة فقط</option>
            </Select>
          </div>

          {/* Month Filter */}
          <div>
            <Input
              type="text"
              placeholder="فلترة بالشهر (مثلاً: 2026-11)"
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs font-mono"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : payments.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات سداد مطابقة"
          description="لم يتم العثور على أي تحويلات تطابق معايير الفلترة الحالية."
          icon={<CreditCard size={28} className="text-fg-muted" />}
        />
      ) : (
        <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full text-start border-collapse text-xs">
            <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
              <tr>
                <th className="py-3 px-4">المشترك / المؤسسة</th>
                <th className="py-3 px-4">الطالب</th>
                <th className="py-3 px-4">الشهر المستحق</th>
                <th className="py-3 px-4">المبلغ</th>
                <th className="py-3 px-4">طريقة التحويل</th>
                <th className="py-3 px-4">الإيصال</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={`${p.tenant.id}-${p.id}`} className="hover:bg-surface-raised transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-fg flex items-center gap-1.5">
                      <Building size={14} className="text-fg-muted shrink-0" />
                      <span>{p.tenant.name}</span>
                    </div>
                    <div className="text-xs text-fg-muted font-mono">{p.tenant.slug}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-fg">
                      {p.student?.user?.name || 'طالب مسجل'}
                    </div>
                    <div className="text-xs text-fg-muted">
                      {p.student?.user?.phone || p.sender_phone || p.student?.user?.email || 'بدون هاتف'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-fg">
                    {p.period_month || (p.submitted_at ? p.submitted_at.slice(0, 7) : '2026-11')}
                    <div className="text-xs text-fg-muted font-sans">
                      {p.submitted_at ? formatDate(p.submitted_at) : 'الآن'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-primary font-mono text-sm">
                      {formatNumber(p.amount)} {p.currency || 'ر.س'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-fg">{getMethodLabel(p.payment_method)}</div>
                    <div className="text-xs text-fg-muted font-mono mt-0.5">
                      {p.reference_code ? `مرجع: ${p.reference_code}` : 'بدون مرجع'}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {p.proof_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewProofPayment(p)}
                        className="text-xs h-7 px-2"
                      >
                        <Eye size={12} className="me-1" />
                        عرض الإيصال
                      </Button>
                    ) : (
                      <span className="text-fg-muted text-xs">بدون مرفق</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">{getStatusBadge(p.status)}</td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInspectingPayment(p)}
                        className="text-xs h-7 px-2"
                      >
                        تفاصيل
                      </Button>
                      {p.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setApprovingPayment(p);
                              setApprovalNotes('');
                            }}
                            className="text-xs h-7 px-2"
                          >
                            اعتماد
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setRejectingPayment(p);
                              setRejectionReason('');
                            }}
                            className="text-xs h-7 px-2"
                          >
                            رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-fg-muted pt-2">
          <span>الصفحة {page} من {totalPages}</span>
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              السابق
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      <Drawer
        isOpen={Boolean(inspectingPayment)}
        onClose={() => setInspectingPayment(null)}
        title="تفاصيل معاملة السداد وتدقيق الحساب"
        subtitle={`طلب رقم #${inspectingPayment?.id.slice(0, 10)} — المشترك: ${inspectingPayment?.tenant.name}`}
        width="lg"
      >
        {inspectingPayment && (
          <div className="space-y-6 text-start">
            <div className="p-4 rounded-md border border-border bg-surface-raised flex items-center justify-between">
              <div>
                <div className="text-xs text-fg-muted">حالة السداد الحالية</div>
                <div className="mt-1">{getStatusBadge(inspectingPayment.status)}</div>
              </div>
              <div className="text-end">
                <div className="text-xs text-fg-muted">المبلغ المسدد</div>
                <div className="text-xl font-bold text-primary font-mono mt-0.5">
                  {formatNumber(inspectingPayment.amount)} {inspectingPayment.currency || 'ر.س'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-md border border-border bg-surface space-y-2">
                <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                  بيانات المشترك والمدرس
                </h4>
                <div className="text-sm font-semibold text-fg">{inspectingPayment.tenant.name}</div>
                <div className="text-xs text-fg-muted font-mono">
                  Slug: {inspectingPayment.tenant.slug}
                </div>
                <div className="text-xs text-fg-muted">
                  المعرف: {inspectingPayment.tenant.id}
                </div>
              </div>

              <div className="p-4 rounded-md border border-border bg-surface space-y-2">
                <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                  بيانات الطالب
                </h4>
                <div className="text-sm font-semibold text-fg">
                  {inspectingPayment.student?.user?.name || 'طالب مسجل'}
                </div>
                <div className="text-xs text-fg-muted">
                  البريد: {inspectingPayment.student?.user?.email || 'غير متوفر'}
                </div>
                <div className="text-xs text-fg-muted">
                  الهاتف: {inspectingPayment.student?.user?.phone || inspectingPayment.sender_phone || 'غير متوفر'}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-md border border-border bg-surface space-y-3">
              <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
                بيانات التحويل البنكي
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-fg-muted">الشهر المطلوب:</span>{' '}
                  <span className="font-mono font-bold text-fg">
                    {inspectingPayment.period_month || '2026-11'}
                  </span>
                </div>
                <div>
                  <span className="text-fg-muted">طريقة الدفع:</span>{' '}
                  <span className="text-fg">{getMethodLabel(inspectingPayment.payment_method)}</span>
                </div>
                <div>
                  <span className="text-fg-muted">الرقم المرجعي:</span>{' '}
                  <span className="font-mono text-fg">
                    {inspectingPayment.reference_code || 'لا يوجد'}
                  </span>
                </div>
                <div>
                  <span className="text-fg-muted">تاريخ التقديم:</span>{' '}
                  <span className="text-fg">
                    {inspectingPayment.submitted_at
                      ? formatDateTime(inspectingPayment.submitted_at)
                      : 'الآن'}
                  </span>
                </div>
              </div>

              {inspectingPayment.proof_url && (
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-fg-muted">إشعار التحويل المرفق:</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPreviewProofPayment(inspectingPayment)}
                  >
                    <Eye size={12} className="me-1.5" />
                    معاينة صورة الإيصال
                  </Button>
                </div>
              )}
            </div>

            {inspectingPayment.status === 'rejected' && inspectingPayment.rejection_reason && (
              <div className="p-4 rounded-md border border-danger/30 bg-danger-subtle text-danger text-xs space-y-1">
                <div className="font-bold">سبب الرفض المسجل:</div>
                <div>{inspectingPayment.rejection_reason}</div>
              </div>
            )}

            {inspectingPayment.status === 'pending' && (
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    setApprovingPayment(inspectingPayment);
                    setApprovalNotes('');
                  }}
                >
                  اعتماد وتفعيل الاشتراك
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() => {
                    setRejectingPayment(inspectingPayment);
                    setRejectionReason('');
                  }}
                >
                  رفض الطلب
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Proof Preview Modal */}
      {previewProofPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-2xl w-full p-5 space-y-4 bg-surface border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-fg">
                إشعار التحويل للطالب {previewProofPayment.student?.user?.name}
              </h3>
              <button
                onClick={() => setPreviewProofPayment(null)}
                className="text-fg-muted hover:text-fg text-sm"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex justify-center p-2 bg-surface-sunken rounded-md max-h-[60vh] overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewProofPayment.proof_url || ''}
                alt="إيصال التحويل"
                className="max-h-[55vh] object-contain rounded-md"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-fg-muted pt-2 border-t border-border">
              <span>المبلغ: {previewProofPayment.amount} ر.س</span>
              <a
                href={previewProofPayment.proof_url || ''}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                فتح في علامة تبويب مستقلة
              </a>
            </div>
          </Card>
        </div>
      )}

      {/* Approve Modal */}
      {approvingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-md w-full p-5 space-y-4 bg-surface border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-fg">تأكيد اعتماد التحويل وتفعيل الاشتراك</h3>
              <button
                onClick={() => setApprovingPayment(null)}
                className="text-fg-muted hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-fg-muted leading-relaxed">
              سيتم تفعيل الاشتراك لشهر{' '}
              <span className="font-bold text-fg">
                {approvingPayment.period_month || '2026-11'}
              </span>{' '}
              للطالب{' '}
              <span className="font-bold text-fg">
                {approvingPayment.student?.user?.name}
              </span>
              ، ومنح كافة صلاحيات الوصول الأكاديمي، وإرسال إشعار فوري للطالب وولي أمره.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-fg font-medium">ملاحظات التحقق (اختياري)</label>
              <Input
                type="text"
                placeholder="مثال: تم التأكد من كشف الحساب بمصرف الراجحي..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setApprovingPayment(null)}
                disabled={isApproving}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? 'جارٍ الاعتماد...' : 'تأكيد الاعتماد'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <Card className="max-w-md w-full p-5 space-y-4 bg-surface border-border">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-danger">رفض طلب السداد</h3>
              <button
                onClick={() => setRejectingPayment(null)}
                className="text-fg-muted hover:text-fg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-fg-muted leading-relaxed">
              يجب تدوين سبب الرفض بوضوح ليتم تضمينه في الإشعار المرسل إلى الطالب وولي الأمر.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-fg font-medium">سبب الرفض (إجباري)</label>
              <textarea
                rows={3}
                placeholder="مثال: صورة الإيصال غير واضحة، يرجى إعادة رفع إشعار التحويل البنكي..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-border bg-surface text-fg focus:outline-hidden focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRejectingPayment(null)}
                disabled={isRejecting}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleReject}
                disabled={isRejecting}
              >
                {isRejecting ? 'جارٍ الرفض...' : 'تأكيد الرفض وإشعار الطالب'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
