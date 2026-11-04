'use client';

import React from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { CredentialItem, IssueCredentialResponse } from '../../../lib/credentials-api';
import type { Student } from '../../../types';

const REPLACEMENT_REASONS = [
  'شراء جهاز جديد للطالب',
  'عطل أو تلف في الجهاز القديم',
  'فقدان أو سرقة الجهاز السابق',
  'تحديث نظام التشغيل وتغير البصمة الرقمية',
  'طلب رسمي من ولي أمر الطالب',
];

export interface IssueCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  expiresAt: string;
  onExpiresAtChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  issuedResult: IssueCredentialResponse | null;
  onCopyCode: (code: string) => void;
}

export const IssueCredentialModal: React.FC<IssueCredentialModalProps> = ({
  isOpen,
  onClose,
  student,
  expiresAt,
  onExpiresAtChange,
  onConfirm,
  isLoading,
  issuedResult,
  onCopyCode,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="إصدار كود دخول جديد للطالب"
      subtitle={`سيتم إنشاء ترخيص دخول فريد للطالب: ${student?.user?.name || ''}`}
      size="md"
      footer={
        !issuedResult && (
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              إلغاء
            </Button>
            <Button variant="primary" onClick={onConfirm} isLoading={isLoading}>
              إصدار الكود
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 py-2 text-start">
        {issuedResult ? (
          <div className="space-y-4 text-center">
            <div className="p-4 rounded-md bg-success-subtle border border-success/30 text-success">
              <h4 className="font-bold text-sm">تم إصدار كود الدخول بنجاح!</h4>
              <p className="text-xs text-fg-muted mt-1">
                يمكن للطالب الآن استخدام هذا الكود لتسجيل الدخول والاقتران بجهازه.
              </p>
            </div>

            <div className="p-4 rounded-md border border-border bg-surface-raised space-y-2">
              <span className="text-xs text-fg-muted block">كود الدخول المخصص:</span>
              <div className="font-mono text-2xl font-bold text-primary tracking-widest">
                {issuedResult.credential.credential_code}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopyCode(issuedResult.credential.credential_code)}
              >
                نسخ الكود
              </Button>
            </div>

            <Button variant="primary" className="w-full" onClick={onClose}>
              تم الانتهاء
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="تاريخ انتهاء الصلاحية (اختياري)"
              type="date"
              value={expiresAt}
              onChange={(e) => onExpiresAtChange(e.target.value)}
              helperText="اتركه فارغاً ليكون الكود صالحاً طوال فترة الفصل الدراسي"
            />
            <p className="text-xs text-fg-muted leading-relaxed">
              تنبيه: إصدار كود جديد يقوم بتعطيل أي كود نشط سابق للطالب لضمان عدم وجود أجهزة متعددة متزامنة.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export interface ReplaceDeviceModalProps {
  cred: CredentialItem | null;
  isOpen: boolean;
  onClose: () => void;
  replaceReason: string;
  onReplaceReasonChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const ReplaceDeviceModal: React.FC<ReplaceDeviceModalProps> = ({
  cred,
  isOpen,
  onClose,
  replaceReason,
  onReplaceReasonChange,
  onConfirm,
  isLoading,
}) => {
  if (!cred) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="استبدال الجهاز المقترن"
      subtitle={`فك ارتباط الجهاز الحالي عن الكود ${cred.credential_code}. يرتبط الجهاز الجديد عند دخول الطالب التالي.`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!replaceReason.trim()}
          >
            تأكيد الاستبدال
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-start">
        <div>
          <label className="text-xs font-semibold text-fg block mb-2">
            سبب استبدال الجهاز:
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REPLACEMENT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onReplaceReasonChange(r)}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  replaceReason === r
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border bg-surface text-fg-muted hover:border-primary/50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            className="w-full h-20 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder="اكتب سبب الاستبدال..."
            value={replaceReason}
            onChange={(e) => onReplaceReasonChange(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

export interface RevokeCredentialModalProps {
  cred: CredentialItem | null;
  isOpen: boolean;
  onClose: () => void;
  revokeReason: string;
  onRevokeReasonChange: (val: string) => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

export const RevokeCredentialModal: React.FC<RevokeCredentialModalProps> = ({
  cred,
  isOpen,
  onClose,
  revokeReason,
  onRevokeReasonChange,
  onConfirm,
  isLoading,
}) => {
  if (!cred) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title="تعطيل كود الدخول"
      subtitle={`سيتم حظر الكود: ${cred.credential_code} ومنع الدخول به نهائياً`}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!revokeReason.trim()}
          >
            تأكيد التعطيل
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-start">
        <div>
          <label className="text-xs font-semibold text-fg block mb-1.5">
            سبب التعطيل:
          </label>
          <textarea aria-label="سبب التعطيل:"
            className="w-full h-24 rounded-sm border border-border bg-surface px-3 py-2 text-xs text-fg placeholder:text-fg-subtle focus:border-danger focus:outline-none focus:ring-1 focus:ring-danger resize-none"
            placeholder="يرجى ذكر سبب التعطيل (تخرج الطالب، إلغاء الاشتراك، نشاط مشبوه...)"
            value={revokeReason}
            onChange={(e) => onRevokeReasonChange(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

