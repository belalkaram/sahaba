'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { billingApi, PackageItem } from '../../../../../lib/billing-api';
import { Card } from '../../../../../components/ui/card';
import { Button } from '../../../../../components/ui/button';
import { Input } from '../../../../../components/ui/input';
import { SkeletonCard } from '../../../../../components/ui/skeleton';
import {
  CreditCardIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  FileTextIcon,
  IconBack,
} from '../../../../../components/icons';
import { formatNumber } from '../../../../../lib/format';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function StudentPlanPaymentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const packageId = resolvedParams.id;

  const [pkg, setPkg] = useState<PackageItem | null>(null);
  const [bankInfo, setBankInfo] = useState<{
    currency?: string;
    receiving_account_type?: string;
    bank_name?: string | null;
    account_holder_name?: string | null;
    iban?: string | null;
    transfer_instructions?: string | null;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [periodMonth, setPeriodMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [paymentMethod, setPaymentMethod] = useState<'instapay' | 'bank_transfer' | 'cash'>('bank_transfer');
  const [senderPhone, setSenderPhone] = useState('');
  const [referenceCode, setReferenceCode] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [pkgData, pricingData] = await Promise.all([
          billingApi.getPackage(packageId).catch(() => null),
          billingApi.getPricing().catch(() => null),
        ]);
        setPkg(pkgData);
        if (pricingData) {
          setBankInfo(pricingData);
        }
      } catch {
        setError('تعذر تحميل بيانات الباقة أو تفاصيل الحساب المصرفي.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [packageId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('حجم الملف يجب ألا يتجاوز 5 ميجابايت.');
      return;
    }

    setProofFile(file);
    setError(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setProofPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) return;

    if (paymentMethod !== 'cash' && !referenceCode.trim() && !proofFile) {
      setError('يرجى كتابة الرقم المرجعي للتحويل أو إرفاق صورة الإيصال للتحقق.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('package_id', pkg.id);
      formData.append('period_month', periodMonth);
      formData.append('amount', String(pkg.price));
      formData.append('payment_method', paymentMethod);
      if (senderPhone.trim()) {
        formData.append('sender_phone', senderPhone.trim());
      }
      if (referenceCode.trim()) {
        formData.append('reference_code', referenceCode.trim());
      }
      if (proofFile) {
        formData.append('proof', proofFile);
      }

      await billingApi.submitPaymentRequest(formData);
      setSuccess(true);
    } catch {
      setError('حدث خطأ أثناء إرسال طلب الدفع. يرجى التأكد من البيانات والمحاولة مجدداً.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <SkeletonCard />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-12 text-start">
        <Card className="p-8 text-center space-y-5 rounded-lg border-success/30 bg-surface shadow-xs">
          <div className="w-16 h-16 rounded-full bg-success-subtle text-success flex items-center justify-center mx-auto">
            <CheckCircleIcon size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-fg">تم استلام طلب السداد بنجاح!</h2>
            <p className="text-xs sm:text-sm text-fg-muted mt-2 leading-relaxed">
              تم إرسال إيصال التحويل وبيانات السداد لشهر{' '}
              <span className="text-fg font-semibold font-mono">{periodMonth}</span> إلى إدارة المنصة
              المركزية للتدقيق والاعتماد. سيتم تفعيل حسابك والاشتراك فور المطابقة.
            </p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/student/payments" className="w-full sm:w-auto">
              <Button variant="primary" className="w-full">
                متابعة حالة طلباتي
              </Button>
            </Link>
            <Link href="/student/courses" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full">
                العودة إلى المقررات
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <p className="text-fg-muted">الباقة المطلوبة غير موجودة أو تم أرشفتها.</p>
        <Link href="/student/plans">
          <Button variant="secondary">العودة للباقات المتاحة</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 text-start">
      {/* Top Breadcrumb */}
      <div>
        <Link
          href="/student/plans"
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
        >
          <IconBack size={14} />
          <span>الرجوع إلى الباقات</span>
        </Link>
      </div>

      {/* Package Header Card */}
      <div className="p-5 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <span className="text-xs font-bold text-primary tracking-wider uppercase">
            الباقة المختارة
          </span>
          <h1 className="text-xl font-bold text-fg mt-0.5">{pkg.name}</h1>
          {pkg.description && (
            <p className="text-xs text-fg-muted mt-1 max-w-lg">{pkg.description}</p>
          )}
        </div>
        <div className="text-end bg-surface-raised px-4 py-2.5 rounded-md border border-border">
          <div className="text-xs text-fg-muted">المبلغ المستحق</div>
          <div className="text-2xl font-bold text-primary font-mono">
            {formatNumber(pkg.price)} {pkg.currency || 'SAR'}
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {error && (
        <div className="p-4 rounded-md border border-danger/30 bg-danger-subtle text-danger text-xs sm:text-sm flex items-center gap-2">
          <AlertCircleIcon size={18} className="shrink-0 text-danger" />
          <span>{error}</span>
        </div>
      )}

      {/* Payment Form Card */}
      <Card className="p-6 rounded-lg space-y-6 bg-surface border border-border shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Payment Method Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-fg uppercase tracking-wider block">
              1. اختر وسيلة الدفع المناسبة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'bank_transfer',
                  label: 'تحويل بنكي مباشر',
                  desc: 'إيداع أو تحويل عبر الحساب المصرفي (IBAN)',
                },
                {
                  id: 'instapay',
                  label: 'InstaPay (إنستاباي)',
                  desc: 'تحويل لحظي عبر الحساب أو رقم الهاتف',
                },
                {
                  id: 'cash',
                  label: 'سداد نقدي بالفرع',
                  desc: 'الدفع المباشر في مقر السنتر أو القاعة',
                },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as typeof paymentMethod)}
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary bg-primary-subtle text-fg shadow-xs'
                        : 'border-border bg-surface-raised/40 text-fg-muted hover:border-border hover:text-fg'
                    }`}
                  >
                    <div className="font-semibold text-xs text-fg">{m.label}</div>
                    <div className="text-xs text-fg-muted mt-1">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transfer Instructions Box */}
          <div className="p-4 rounded-md border border-border bg-surface-raised/50 space-y-2 text-xs text-fg-muted leading-relaxed">
            <div className="font-semibold text-fg flex items-center gap-1.5">
              <CreditCardIcon size={14} className="text-primary" />
              <span>بيانات وتعليمات التحويل:</span>
            </div>
            {paymentMethod === 'bank_transfer' && (
              <div className="space-y-1">
                <p>
                  البنك: <span className="text-fg font-bold">{bankInfo?.bank_name || 'مصرف الراجحي'}</span>
                  {bankInfo?.account_holder_name && (
                    <> — المستفيد: <span className="text-fg font-bold">{bankInfo.account_holder_name}</span></>
                  )}
                </p>
                <p>
                  رقم الآيبان (IBAN):{' '}
                  <span className="text-primary font-mono font-bold select-all">
                    {bankInfo?.iban || 'SA0000000000000000000000'}
                  </span>
                </p>
                {bankInfo?.transfer_instructions && (
                  <p className="text-fg-muted pt-1 border-t border-border mt-1">
                    {bankInfo.transfer_instructions}
                  </p>
                )}
              </div>
            )}
            {paymentMethod === 'instapay' && (
              <p>
                يرجى التحويل إلى عنوان إنستاباي أو الحساب البنكي الموضح، ثم إرفاق لقطة شاشة للإيصال وكتابة الرقم المرجعي.
              </p>
            )}
            {paymentMethod === 'cash' && (
              <p>
                يمكنك التوجه إلى مقر السنتر أو القاعة وسداد الرسوم نقداً، ثم تسجيل رقم الإيصال هنا لمطابقة السجل.
              </p>
            )}
          </div>

          {/* Step 2: Verification Details */}
          <div className="space-y-4 pt-2 border-t border-border">
            <label className="text-xs font-bold text-fg uppercase tracking-wider block">
              2. بيانات الشهر والتأكيد:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">
                  الشهر المراد سداده:
                </label>
                <Input
                  type="text"
                  placeholder="YYYY-MM (مثال: 2026-11)"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">
                  رقم هاتف المُرسل / المحوّل:
                </label>
                <Input
                  placeholder="مثال: 0501234567"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-fg-muted mb-1.5 block">
                  الرقم المرجعي للعملية:
                </label>
                <Input
                  placeholder="رقم المعاملة البنكية"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Proof Upload */}
            <div>
              <label className="text-xs font-medium text-fg-muted mb-1.5 block">
                مستند الإيصال / لقطة الشاشة (JPEG, PNG, PDF حتى 5 ميجابايت):
              </label>

              <div className="border-2 border-dashed border-border rounded-md p-5 text-center hover:border-primary/50 transition-colors bg-surface-sunken/40">
                <input
                  type="file"
                  id="proof-upload"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="proof-upload" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 rounded-full bg-primary-subtle text-primary flex items-center justify-center mx-auto">
                    <FileTextIcon size={20} />
                  </div>
                  <div className="text-xs text-fg font-medium">
                    {proofFile ? proofFile.name : 'اضغط لاختيار ملف الإيصال أو اسحبه هنا'}
                  </div>
                  <div className="text-xs text-fg-muted">
                    {proofFile
                      ? `${formatNumber(proofFile.size / 1024 / 1024, 2)} MB`
                      : 'يدعم صيغ JPG، PNG، أو مستندات PDF بحد أقصى 5 ميجابايت'}
                  </div>
                </label>
              </div>

              {/* Image Preview */}
              {proofPreview && (
                <div className="mt-3 p-2 rounded-sm border border-border bg-surface inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proofPreview}
                    alt="معاينة الإيصال"
                    className="max-h-40 rounded-xs object-contain"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Link href="/student/plans">
              <Button variant="secondary" type="button" disabled={submitting}>
                إلغاء
              </Button>
            </Link>
            <Button
              variant="primary"
              type="submit"
              disabled={submitting}
              isLoading={submitting}
              className="px-6"
            >
              إرسال طلب السداد للمراجعة المركزية
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
