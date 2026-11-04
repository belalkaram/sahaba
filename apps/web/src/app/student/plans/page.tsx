'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { billingApi, PackageItem } from '../../../lib/billing-api';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonCard } from '../../../components/ui/skeleton';

import {
  CreditCardIcon,
  CheckCircleIcon,
  CheckIcon,
  SparklesIcon,
  ShieldIcon,
  ClockIcon,
  IconNext,
} from '../../../components/icons'

import { formatNumber } from '../../../lib/format';
export default function StudentPlansPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPackages() {
      try {
        setLoading(true);
        const data = await billingApi.getPackages('active');
        setPackages(data);
      } catch {
        setError('تعذر تحميل باقات الاشتراك. يرجى المحاولة لاحقاً.');
      } finally {
        setLoading(false);
      }
    }
    loadPackages();
  }, []);

  const formatCycle = (cycle?: string) => {
    switch (cycle) {
      case 'yearly':
        return 'سنوياً';
      case 'term':
        return 'للترم الدراسي';
      case 'monthly':
      default:
        return 'شهرياً';
    }
  };

  const getEntitlementLabel = (key: string) => {
    if (key === 'all_courses' || key === 'ONLINE_ACCESS') {
      return 'صلاحية الوصول الشامل لجميع الكورسات والدروس المتاحة';
    }
    if (key.startsWith('course:')) {
      const courseId = key.replace('course:', '');
      return `الوصول الكامل لمحتوى المقرر (#${courseId.slice(0, 8)})`;
    }
    return `صلاحية: ${key}`;
  };

  return (
    <div className="space-y-8 pb-12 text-start">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-subtle border border-primary/20 text-primary text-xs font-semibold">
          <SparklesIcon size={14} />
          <span>خطط وباقات الاشتراك للعام الدراسي</span>
        </div>
        <h1 className="text-3xl font-extrabold text-fg tracking-tight">
          اختر الباقة المناسبة لاحتياجاتك التعليمية
        </h1>
        <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
          اشتراكات مرنة تتيح لك مشاهدة الدروس المسجلة، حضور الحصص المباشرة، وحل الامتحانات وبنوك الأسئلة المعتمدة.
        </p>
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-surface border border-border text-xs text-fg-muted shadow-xs">
          <div className="p-2 rounded-md bg-success-subtle text-success">
            <CheckCircleIcon size={18} />
          </div>
          <div>
            <div className="font-semibold text-fg">تفعيل فوري ودقيق</div>
            <div>يتم تفعيل الاشتراك بمجرد مراجعة التحويل</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-surface border border-border text-xs text-fg-muted shadow-xs">
          <div className="p-2 rounded-md bg-primary-subtle text-primary">
            <ShieldIcon size={18} />
          </div>
          <div>
            <div className="font-semibold text-fg">وسائل دفع متعددة</div>
            <div>InstaPay، المحافظ الإلكترونية، أو التحويل البنكي</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-surface border border-border text-xs text-fg-muted shadow-xs">
          <div className="p-2 rounded-md bg-primary-subtle text-primary">
            <ClockIcon size={18} />
          </div>
          <div>
            <div className="font-semibold text-fg">دعم فني مستمر</div>
            <div>متابعة ومساعدة للطلاب طوال فترة الاشتراك</div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-md border border-danger/30 bg-danger-subtle text-danger text-xs sm:text-sm text-center">
          {error}
        </div>
      )}

      {/* Packages Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : packages.length === 0 ? (
        <div className="max-w-md mx-auto">
          <EmptyState
            title="لا توجد باقات متاحة حالياً"
            description="لم يتم طرح باقات اشتراك جديدة في الوقت الحالي. يرجى مراجعة إدارة المركز أو المعلم."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
          {packages.map((pkg, idx) => {
            const isFeatured = idx === 1 || packages.length === 1;

            return (
              <Card
                key={pkg.id}
                className={`flex flex-col justify-between p-6 rounded-2xl relative transition-all shadow-xs ${
                  isFeatured
                    ? 'border-primary/50 bg-surface ring-1 ring-primary/20 shadow-md'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 start-6">
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-fg uppercase tracking-wider shadow-xs">
                      الأكثر اختياراً
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Title & Code */}
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-fg">{pkg.name}</h3>
                      {pkg.code && (
                        <span className="font-mono text-xs text-fg-muted bg-surface-raised px-2 py-0.5 rounded-xs border border-border">
                          {pkg.code}
                        </span>
                      )}
                    </div>
                    {pkg.description && (
                      <p className="text-xs text-fg-muted mt-2 line-clamp-2 leading-relaxed">
                        {pkg.description}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="pt-2 pb-4 border-b border-border">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold text-fg font-mono">
                        {formatNumber(pkg.price)}
                      </span>
                      <span className="text-sm font-semibold text-primary">
                        {pkg.currency || 'EGP'}
                      </span>
                      <span className="text-xs text-fg-muted">
                        / {formatCycle(pkg.billing_cycle)}
                      </span>
                    </div>
                  </div>

                  {/* Entitlements / Benefits */}
                  <div className="space-y-2.5 pt-1">
                    <div className="text-xs font-semibold text-fg">
                      المزايا والصلاحيات المشمولة:
                    </div>
                    {pkg.entitlements && pkg.entitlements.length > 0 ? (
                      <ul className="space-y-2 text-xs text-fg-muted">
                        {pkg.entitlements.map((ent, eIdx) => (
                          <li key={eIdx} className="flex items-start gap-2">
                            <span className="p-0.5 rounded-full bg-success-subtle text-success mt-0.5 shrink-0">
                              <CheckIcon size={12} />
                            </span>
                            <span className="leading-snug">{getEntitlementLabel(ent.entitlement_key)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-fg-muted flex items-center gap-2">
                        <span className="p-0.5 rounded-full bg-primary-subtle text-primary shrink-0">
                          <CheckIcon size={12} />
                        </span>
                        <span>إمكانية الوصول للمقررات والدروس التدريبية الأساسية</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subscribe CTA */}
                <div className="pt-6 mt-6 border-t border-border">
                  <Link href={`/student/plans/${pkg.id}/pay`} className="block">
                    <Button
                      variant={isFeatured ? 'primary' : 'secondary'}
                      className="w-full flex items-center justify-center gap-2 py-2.5 font-semibold text-xs"
                    >
                      <CreditCardIcon size={16} />
                      <span>اشترك الآن وسدد</span>
                      <IconNext size={14}  />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Navigation shortcuts */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-6 text-xs text-fg-muted">
        <span>لديك طلب دفع سابق؟</span>
        <Link href="/student/payments" className="text-primary hover:underline font-semibold">
          متابعة حالة طلبات السداد
        </Link>
        <span>•</span>
        <Link href="/student/subscriptions" className="text-primary hover:underline font-semibold">
          عرض اشتراكاتك وصلاحياتك النشطة
        </Link>
      </div>
    </div>
  );
}
