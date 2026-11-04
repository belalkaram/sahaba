'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  billingApi,
  SubscriptionItem,
  EntitlementItem,
} from '../../../lib/billing-api';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonCard } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/ui/page-header';
import { ClockIcon, BookOpenIcon, ShieldIcon, CreditCardIcon } from '../../../components/icons';

import { formatDate } from '../../../lib/format';
export default function StudentSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [subs, ents] = await Promise.all([
          billingApi.getMySubscriptions(),
          billingApi.getMyEntitlements(),
        ]);
        setSubscriptions(subs);
        setEntitlements(ents);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getEntitlementDescription = (key: string) => {
    if (key === 'all_courses' || key === 'ONLINE_ACCESS') {
      return 'وصول كامل وشامل لجميع المقررات التعليمية والمحاضرات على المنصة';
    }
    if (key.startsWith('course:')) {
      const courseId = key.replace('course:', '');
      return `صلاحية وصول لمحتوى المقرر الدراسي (#${courseId.slice(0, 8)})`;
    }
    return `صلاحية نظام: ${key}`;
  };

  return (
    <div className="space-y-8 pb-12 text-start">
      {/* Header */}
      <PageHeader
        title="اشتراكاتي وصلاحياتي الأكاديمية"
        subtitle="استعرض الاشتراكات النشطة في الباقات وصلاحيات الوصول الممنوحة لحسابك."
        actions={
          <Link href="/student/plans">
            <Button variant="primary" size="sm">
              ترقية أو تجديد الاشتراك
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : subscriptions.length === 0 && entitlements.length === 0 ? (
        <Card className="p-12 text-center bg-surface border border-border shadow-xs">
          <EmptyState
            title="لا توجد اشتراكات أو صلاحيات مفعلة حالياً"
            description="حسابك لا يحتوي على أي باقة نشطة. يمكنك تصفح الباقات المتاحة والاشتراك للوصول للمحتوى الدراسي."
            action={{
              label: 'استعراض باقات الاشتراك',
              onClick: () => {
                window.location.href = '/student/plans';
              },
            }}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Active Subscriptions */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <CreditCardIcon size={18} className="text-primary" />
              <span>الباقات والاشتراكات النشطة:</span>
            </h2>

            {subscriptions.length === 0 ? (
              <Card className="p-6 text-center text-xs text-fg-muted bg-surface border border-border shadow-xs">
                لا توجد باقات تجارية نشطة، ولكن قد تمتلك صلاحيات وصول فردية أو منح دراسية أدناه.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscriptions.map((sub) => {
                  const pkgName = sub.package?.name || 'باقة اشتراك';
                  const isActive = sub.status === 'active';

                  return (
                    <Card
                      key={sub.id}
                      className="p-5 rounded-lg border border-border bg-surface space-y-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-primary font-semibold">باقة تعليمية</div>
                          <h3 className="text-lg font-bold text-fg mt-0.5">{pkgName}</h3>
                          {sub.package?.code && (
                            <span className="font-mono text-xs text-fg-muted">
                              كود: {sub.package.code}
                            </span>
                          )}
                        </div>
                        <Badge variant={isActive ? 'success' : 'neutral'}>
                          {isActive ? 'نشط وساري' : sub.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-surface-raised/50 p-3 rounded-md border border-border">
                        <div>
                          <span className="text-fg-muted block">تاريخ البدء:</span>
                          <span className="text-fg font-medium">
                            {sub.starts_at
                              ? formatDate(sub.starts_at)
                              : sub.created_at
                              ? formatDate(sub.created_at)
                              : 'فوري'}
                          </span>
                        </div>
                        <div>
                          <span className="text-fg-muted block">تاريخ الانتهاء:</span>
                          <span className="text-fg font-medium">
                            {sub.ends_at
                              ? formatDate(sub.ends_at)
                              : 'مستمر / غير محدد'}
                          </span>
                        </div>
                      </div>

                      {/* Package Entitlements Preview */}
                      {sub.package?.entitlements && sub.package.entitlements.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-border text-xs">
                          <span className="text-fg-muted font-medium block">
                            الصلاحيات المشمولة بالباقة:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {sub.package.entitlements.map((e, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-xs bg-primary-subtle text-primary text-xs font-mono border border-primary/20"
                              >
                                {e.entitlement_key}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Active Entitlements */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <ShieldIcon size={18} className="text-success" />
              <span>الصلاحيات وحقوق الوصول الفعلية (Entitlements):</span>
            </h2>

            <Card className="overflow-hidden bg-surface border border-border shadow-xs">
              <div tabIndex={0} className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-surface-raised border-b border-border text-fg-muted">
                    <tr>
                      <th className="py-3 px-4 font-semibold">مفتاح الصلاحية (Key)</th>
                      <th className="py-3 px-4 font-semibold">الوصف ونطاق الوصول</th>
                      <th className="py-3 px-4 font-semibold">تاريخ الصلاحية</th>
                      <th className="py-3 px-4 font-semibold">الحالة</th>
                      <th className="py-3 px-4 font-semibold text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {entitlements.map((ent) => (
                      <tr key={ent.id} className="hover:bg-surface-raised/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                          {ent.entitlement_key}
                        </td>
                        <td className="py-3.5 px-4 text-fg">
                          {getEntitlementDescription(ent.entitlement_key)}
                          {ent.reason && (
                            <div className="text-xs text-fg-muted mt-0.5">
                              ملاحظة: {ent.reason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-fg-muted">
                          {ent.expires_at ? (
                            <span className="flex items-center gap-1 font-mono">
                              <ClockIcon size={12} />
                              {formatDate(ent.expires_at)}
                            </span>
                          ) : (
                            <span className="text-success font-medium">دائم / غير محدد</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="success">صالح ونشط</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link href="/student/courses">
                            <Button variant="secondary" size="sm">
                              <BookOpenIcon size={12} className="me-1" />
                              المقررات
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
