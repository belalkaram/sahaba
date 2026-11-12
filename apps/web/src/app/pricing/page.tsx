'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PublicPage } from '../../components/layout/public-chrome';
import { publicApi, type PublicPricing } from '../../lib/public-api';
import { Check, HelpCircle, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { IconNext } from '../../components/icons/directional';

const DEFAULT_HEADLINE = 'الطالب لا يدفع للمنصة شيئاً. الأكاديمية أو المدرس يشترون مقاعد (طالب = كود) من إدارة المنصة.';

/**
 * OD-39 / ADR-006 (PLAT-FEE-1): students pay the platform nothing; academies and independent teachers buy seats
 * (one student = one code = one device) from the platform, by manual bank transfer reviewed by the super admin.
 * No seat price is shown: it is agreed with the platform team (not set in the product yet).
 */
export default function PricingPage() {
  const [pricing, setPricing] = useState<PublicPricing | null>(null);

  useEffect(() => {
    publicApi
      .getPricing()
      .then(setPricing)
      .catch(() => setPricing(null));
  }, []);

  const academyFeatures = [
    'قاعدة بيانات مستقلة لكل مؤسسة أو معلم مستقل',
    'كل مقعد = طالب واحد بكود واحد يعمل على جهاز واحد',
    'تبدأ بعدد مقاعد عند التسجيل، وتطلب الزيادة متى احتجت',
    'الزيادة بتحويل بنكي يدوي تراجعه إدارة المنصة وتضيف المقاعد',
    'حضور بمسح QR، واجبات واختبارات، تقارير وإشعارات لأولياء الأمور',
    'حسابات المساعدين وأولياء الأمور لا تستهلك مقاعد',
  ];

  const studentFeatures = [
    'لا رسوم شهرية للمنصة على الطالب',
    'بطاقة رقمية للحضور، دروس، واجبات واختبارات',
    'ربط بولي الأمر لاستلام إشعارات الحضور والدرجات',
    'إذا باعت الأكاديمية باقات مدفوعة، يدفع الطالب للأكاديمية حسب باقتها',
  ];

  return (
    <PublicPage>
      <div className="relative overflow-hidden px-6 py-12 text-start">
        <div className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[160px]" />

        <div className="relative z-10 mx-auto max-w-6xl space-y-16">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Badge variant="success" size="sm">
              <Sparkles size={12} className="me-1 inline" />
              تسعير بالمقاعد
            </Badge>
            <h1 className="text-3xl font-black tracking-tight text-fg sm:text-5xl">{pricing?.headline || DEFAULT_HEADLINE}</h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">
              تدفع الأكاديمية أو المدرس المستقل مقابل عدد الطلاب فقط. كل طالب له كود واحد يعمل على جهاز واحد، والكود الإضافي لجهاز ثانٍ مقعد إضافي.
            </p>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-8 md:grid-cols-2">
            <Card className="relative flex flex-col justify-between rounded-2xl border-primary/40 bg-surface p-8 shadow-md ring-1 ring-primary/20">
              <div className="space-y-6">
                <div>
                  <Badge variant="brand" size="sm" className="mb-2">
                    للأكاديميات والمدرسين المستقلين
                  </Badge>
                  <h2 className="text-2xl font-bold text-fg">مقاعد حسب عدد طلابك</h2>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">سعر المقعد يُتفق عليه مع فريق المنصة. تواصل معنا لمعرفة التفاصيل.</p>
                </div>
                <div className="flex items-center gap-2 border-t border-border pt-4 text-sm font-semibold text-fg">
                  <KeyRound size={18} className="text-primary" aria-hidden /> طالب = كود = جهاز واحد
                </div>
                <FeatureList items={academyFeatures} />
              </div>
              <div className="mt-8 grid gap-2 border-t border-border pt-8 sm:grid-cols-2">
                <Link href="/register-school" className="block">
                  <Button variant="primary" className="w-full py-2.5 text-xs font-semibold">
                    <span>سجّل أكاديميتك</span>
                    <IconNext size={14} className="ms-1.5" />
                  </Button>
                </Link>
                <Link href="/contact" className="block">
                  <Button variant="secondary" className="w-full py-2.5 text-xs font-semibold">
                    تواصل معنا للأسعار
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="relative flex flex-col justify-between rounded-2xl border-border bg-surface p-8 shadow-xs">
              <div className="space-y-6">
                <div>
                  <Badge variant="neutral" size="sm" className="mb-2">
                    للطلاب وأولياء الأمور
                  </Badge>
                  <h2 className="text-2xl font-bold text-fg">بدون رسوم للمنصة</h2>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-black text-fg sm:text-5xl">0</span>
                    <span className="font-sans text-lg font-bold text-fg-muted">{pricing?.currency === 'SAR' || !pricing ? 'ريال' : pricing.currency} للمنصة</span>
                  </div>
                </div>
                <FeatureList items={studentFeatures} />
              </div>
              <div className="mt-8 border-t border-border pt-8">
                <Link href="/register" className="block w-full">
                  <Button variant="secondary" className="w-full py-2.5 text-xs font-semibold">
                    <span>سجّل كطالب جديد</span>
                    <IconNext size={14} className="ms-1.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-2xl border border-border bg-surface-raised p-6 sm:flex-row">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-1 text-center sm:text-start">
              <h3 className="text-sm font-bold text-fg">قاعدة بيانات معزولة لكل مؤسسة</h3>
              <p className="text-xs leading-relaxed text-fg-muted">لكل مؤسسة أو معلم مستقل مساحة وقاعدة بيانات منفصلة، فلا تختلط سجلات الحضور والدرجات بين المؤسسات.</p>
            </div>
          </div>

          <div className="mx-auto max-w-3xl space-y-6 pt-4">
            <div className="space-y-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <HelpCircle size={14} />
                <span>الأسئلة الشائعة</span>
              </div>
              <h2 className="text-xl font-bold text-fg sm:text-2xl">كل ما تريد معرفته عن التسعير</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Faq q="ماذا يعني «مقعد»؟" a="المقعد طالب واحد بكود واحد يعمل على جهاز واحد. إذا أراد الطالب جهازاً ثانياً يحتاج كوداً إضافياً، وهو مقعد إضافي. تغيير الجهاز (وقفل القديم) لا يستهلك مقعداً." />
              <Faq q="كيف أزيد عدد المقاعد؟" a="من لوحة الأكاديمية افتح «السعة»: حوّل المبلغ واكتب عدد المقاعد وأرفق الإثبات. تراجع إدارة المنصة الطلب وتضيف المقاعد. الدفع حالياً يدوي بالتحويل البنكي." />
              <Faq q="هل يدفع الطالب شيئاً للمنصة؟" a="لا. قد يدفع الطالب للأكاديمية إذا كانت تبيع باقات مدفوعة، لكنه لا يدفع للمنصة." />
            </div>
          </div>
        </div>
      </div>
    </PublicPage>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 pt-2 text-xs text-fg">
      {items.map((feat) => (
        <li key={feat} className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
            <Check size={11} strokeWidth={2.5} />
          </div>
          <span className="leading-relaxed">{feat}</span>
        </li>
      ))}
    </ul>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <Card className="space-y-2 border-border bg-surface p-5">
      <h4 className="text-sm font-bold text-fg">{q}</h4>
      <p className="text-xs leading-relaxed text-fg-muted">{a}</p>
    </Card>
  );
}
