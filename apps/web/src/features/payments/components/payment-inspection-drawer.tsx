'use client';

import React from 'react';
import { Drawer } from '../../../components/ui/drawer';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { billingApi, PaymentRequestItem } from '../../../lib/billing-api';
import { FileTextIcon } from '../../../components/icons';

import { formatDateTime } from '../../../lib/format';
export interface PaymentInspectionDrawerProps {
  payment: PaymentRequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (payment: PaymentRequestItem) => void;
  onReject: (payment: PaymentRequestItem) => void;
  getMethodLabel: (method: string) => string;
}

export const PaymentInspectionDrawer: React.FC<PaymentInspectionDrawerProps> = ({
  payment,
  isOpen,
  onClose,
  onApprove,
  onReject,
  getMethodLabel,
}) => {
  if (!payment) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">معتمدة ومفعلة</Badge>;
      case 'rejected':
        return <Badge variant="danger">مرفوضة</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">قيد المراجعة</Badge>;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="تفاصيل المعاملة البنكية والتحقق"
      subtitle={`معاملة رقم #${payment.id.slice(0, 12)} — ${payment.package?.name ?? 'باقة الاشتراك'}`}
      width="lg"
    >
      <div className="space-y-6 text-start">
        {/* Status & Highlights */}
        <div className="p-4 rounded-md border border-border bg-surface-raised flex items-center justify-between">
          <div>
            <div className="text-xs text-fg-muted">حالة السداد الحالية</div>
            <div className="mt-1">{getStatusBadge(payment.status)}</div>
          </div>
          <div className="text-end">
            <div className="text-xs text-fg-muted">المبلغ المطلوب تدقيقه</div>
            <div className="text-xl font-bold text-primary font-mono mt-0.5">
              {payment.amount} {payment.currency || 'ر.س'}
            </div>
          </div>
        </div>

        {/* Student & Package Summary Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-md border border-border bg-surface space-y-2">
            <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
              بيانات الطالب
            </h4>
            <div className="text-sm font-semibold text-fg">
              {payment.student?.user?.name || 'طالب مسجل'}
            </div>
            <div className="text-xs text-fg-muted">
              البريد: {payment.student?.user?.email || 'غير مسجل'}
            </div>
            <div className="text-xs text-fg-muted">
              الهاتف: {payment.student?.user?.phone || payment.sender_phone || 'غير مسجل'}
            </div>
          </div>

          <div className="p-4 rounded-md border border-border bg-surface space-y-2">
            <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
              تفاصيل الباقة والمحتوى
            </h4>
            <div className="text-sm font-semibold text-fg">
              {payment.package?.name || 'باقة اشتراك شهري'}
            </div>
            <div className="text-xs text-fg-muted font-mono">
              كود الباقة: {payment.package?.code || 'PKG-BASIC'}
            </div>
            <div className="text-xs text-primary">
              الاشتراك يمنح صلاحية الوصول لجميع الدروس والامتحانات المشمولة
            </div>
          </div>
        </div>

        {/* Transfer & Proof Information */}
        <div className="p-4 rounded-md border border-border bg-surface space-y-3">
          <h4 className="text-xs font-bold text-fg-muted uppercase tracking-wider">
            بيانات إيصال التحويل البنكي
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-fg-muted">وسيلة التحويل:</span>{' '}
              <span className="text-fg font-medium">
                {getMethodLabel(payment.payment_method)}
              </span>
            </div>
            <div>
              <span className="text-fg-muted">رقم المرجع البنكي:</span>{' '}
              <span className="text-fg font-mono font-medium">
                {payment.reference_code || 'غير متوفر'}
              </span>
            </div>
            <div>
              <span className="text-fg-muted">رقم هاتف المحول:</span>{' '}
              <span className="text-fg font-mono">
                {payment.sender_phone || 'غير مسجل'}
              </span>
            </div>
            <div>
              <span className="text-fg-muted">تاريخ الإرسال:</span>{' '}
              <span className="text-fg">
                {payment.submitted_at
                  ? formatDateTime(payment.submitted_at)
                  : 'منذ قليل'}
              </span>
            </div>
          </div>

          {/* Receipt Preview Box */}
          <div className="mt-4 pt-3 border-t border-border">
            <div className="text-xs text-fg-muted mb-2">مستند الإيصال المرفق:</div>
            {payment.proof_path ? (
              <div className="rounded-sm overflow-hidden border border-border bg-surface-sunken p-2">
                <img
                  src={billingApi.getPaymentProofUrl(payment.id)}
                  alt="إيصال التحويل"
                  className="max-h-64 mx-auto object-contain rounded-xs"
                />
                <div className="mt-2 text-center">
                  <a
                    href={billingApi.getPaymentProofUrl(payment.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    فتح الإيصال في نافذة جديدة
                  </a>
                </div>
              </div>
            ) : payment.proof_url ? (
              <div className="rounded-sm overflow-hidden border border-border bg-surface-sunken p-2">
                <img
                  src={payment.proof_url}
                  alt="إيصال التحويل"
                  className="max-h-64 mx-auto object-contain rounded-xs"
                />
              </div>
            ) : (
              <div className="p-6 rounded-sm border border-dashed border-border bg-surface-sunken text-center">
                <FileTextIcon size={32} className="text-fg-subtle mx-auto mb-2" />
                <p className="text-xs text-fg-muted">
                  لم يقم الطالب بإرفاق صورة ضوئية للإيصال (تم الاعتماد على الرقم المرجعي البنكي).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Note */}
        {payment.status === 'rejected' && payment.rejection_reason && (
          <div className="p-4 rounded-md border border-danger/30 bg-danger-subtle/30 space-y-1">
            <div className="text-xs font-bold text-danger">سبب الرفض المسجل:</div>
            <div className="text-xs text-fg">{payment.rejection_reason}</div>
            {payment.reviewed_at && (
              <div className="text-xs text-fg-muted mt-1">
                تم الرفض في: {formatDateTime(payment.reviewed_at)}
              </div>
            )}
          </div>
        )}

        {/* Reviewer Note */}
        {payment.status === 'approved' && payment.reviewer && (
          <div className="p-4 rounded-md border border-success/30 bg-success-subtle/30 space-y-1">
            <div className="text-xs font-bold text-success">بيانات الاعتماد:</div>
            <div className="text-xs text-fg">
              تم اعتماد التحويل وتفعيل الاشتراك بواسطة: {payment.reviewer.name || 'المعلم'}
            </div>
          </div>
        )}

        {/* Action Buttons in Drawer */}
        {payment.status === 'pending' && (
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => onApprove(payment)}
            >
              اعتماد وتفعيل الاشتراك
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => onReject(payment)}
            >
              رفض الحوالة
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
};

