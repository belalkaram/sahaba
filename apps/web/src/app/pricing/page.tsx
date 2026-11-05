'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PublicPage } from '../../components/layout/public-chrome';
import { publicApi, PublicPricing } from '../../lib/public-api';
import { formatNumber } from '../../lib/format';
import { Check, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';
import { IconNext } from '../../components/icons/directional';

export default function PricingPage() {
  const [pricing, setPricing] = useState<PublicPricing>({
    student_monthly_fee: 10,
    currency: 'SAR',
    teacher_fee: 0,
    organization_fee: 0,
    headline: 'مجانًا للمدرس والسنتر، 10 ريال للطالب في الشهر',
  });

  useEffect(() => {
    publicApi
      .getPricing()
      .then((data) => {
        if (data && data.student_monthly_fee) {
          setPricing(data);
        }
      })
      .catch(() => {
        // Fallback to default 10 SAR
      });
  }, []);

  const teacherFeatures = [
    'قاعدة بيانات سحابية معزولة تماماً (100% Tenant Isolation)',
    'عدد غير محدود من الطلاب والفصول والقاعات الدراسية',
    'تسجيل الحضور والغياب الذكي بمسح الـ QR بكاميرا الموبايل',
    'متابعة حل الواجبات ورصد درجات الكويزات الأوفلاين والأونلاين',
    'حسابات مجانية لمساعدي المستر لإدارة الحصص والقاعات',
    'بوابة خاصة لأولياء الأمور لمتابعة الأبناء والإشعارات الفورية',
    'لوحة تحليلات وتقارير حضور ومستوى أكاديمي لحظية',
    'لا توجد رسوم خفية أو نسب مقتطعة — مجانًا بالكامل',
  ];

  const studentFeatures = [
    'بطاقة الطالب الرقمية الذكية للحضور السريع بالسنتر والقاعات',
    'الوصول لجميع الدروس والواجبات والمذكرات الدراسية المعتمدة',
    'أداء الاختبارات والواجبات واستلام نتائج التصحيح التلقائي',
    'ربط مباشر بحساب ولي الأمر لاستلام إشعارات الحضور والواجبات',
    'سجل أكاديمي كامل لدرجات الكويزات ونسب الحضور',
    'سداد يدوي شهري بسيط ومباشر عبر التحويل البنكي',
  ];

  return (
    <PublicPage>
      <div className="py-12 px-6 relative overflow-hidden text-start">
        {/* Background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[160px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10 space-y-16">
          {/* Heading */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <Badge variant="success" size="sm">
              <Sparkles size={12} className="me-1 inline" />
              تسعير شفاف وعادل بدون تعقيد (OD-27)
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-black text-fg tracking-tight">
              {pricing.headline || 'مجانًا للمدرس والسنتر، 10 ريال للطالب في الشهر'}
            </h1>
            <p className="text-sm sm:text-base text-fg-muted max-w-2xl mx-auto leading-relaxed">
              نموذج تشغيل عادل يتيح للمعلمين والمراكز التعليمية العمل بأحدث التقنيات السحابية مجانًا بالكامل،
              مع رسم اشتراك شهري رمزي لكل طالب نشط.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
            {/* Card 1: Teachers & Centers (Free) */}
            <Card className="p-8 bg-surface border-border flex flex-col justify-between rounded-2xl relative shadow-xs">
              <div className="space-y-6">
                <div>
                  <Badge variant="neutral" size="sm" className="mb-2">
                    للمعلمين والمراكز
                  </Badge>
                  <h2 className="text-2xl font-bold text-fg">حساب المعلم والمؤسسة</h2>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                    منصة متكاملة للمدرسين المستقلين، السناتر، الأكاديميات، والمدارس.
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-fg font-mono">0</span>
                    <span className="text-lg font-bold text-fg-muted font-sans">ريال / شهرياً</span>
                  </div>
                  <div className="text-xs text-success font-semibold mt-1 flex items-center gap-1">
                    <Check size={14} strokeWidth={2.5} />
                    <span>مجانًا دائمًا بدون أي اشتراكات سنوية أو رسوم إعداد</span>
                  </div>
                </div>

                <ul className="space-y-3 pt-2 text-xs text-fg">
                  {teacherFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-success-subtle text-success flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 border-t border-border mt-8">
                <Link href="/login" className="block w-full">
                  <Button variant="secondary" className="w-full text-xs font-semibold py-2.5">
                    <span>تسجيل دخول المعلمين</span>
                    <IconNext size={14} className="ms-1.5" />
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Card 2: Students (10 SAR/Month) */}
            <Card className="p-8 bg-surface border-primary/40 flex flex-col justify-between rounded-2xl relative shadow-md ring-1 ring-primary/20">
              <div className="absolute -top-3.5 start-8">
                <Badge variant="brand" size="sm" className="shadow-xs font-bold px-3 py-1">
                  الباقة الأكاديمية للطالب
                </Badge>
              </div>

              <div className="space-y-6 pt-2">
                <div>
                  <Badge variant="brand" size="sm" className="mb-2">
                    للطلاب وأولياء الأمور
                  </Badge>
                  <h2 className="text-2xl font-bold text-fg">اشتراك الطالب الشهري</h2>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                    وصول شامل ومستمر للدروس، الواجبات، بنك الأسئلة، وكارت الحضور بالسنتر.
                  </p>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-primary font-mono">
                      {formatNumber(pricing.student_monthly_fee)}
                    </span>
                    <span className="text-lg font-bold text-fg-muted font-sans">
                      {pricing.currency || 'ر.س'} / شهرياً
                    </span>
                  </div>
                  <div className="text-xs text-fg-muted mt-1">
                    يدفعها الطالب لكل اشتراك مدرس نشط في الشهر، بمراجعة معتمدة ومباشرة
                  </div>
                </div>

                <ul className="space-y-3 pt-2 text-xs text-fg">
                  {studentFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary-subtle text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} strokeWidth={2.5} />
                      </div>
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 border-t border-border mt-8">
                <Link href="/login" className="block w-full">
                  <Button variant="primary" className="w-full text-xs font-semibold py-2.5">
                    <span>تسجيل دخول الطالب أو ولي الأمر</span>
                    <IconNext size={14} className="ms-1.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          {/* Tenant Isolation Security Banner */}
          <div className="max-w-4xl mx-auto p-6 rounded-2xl border border-border bg-surface-raised flex flex-col sm:flex-row items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck size={28} />
            </div>
            <div className="space-y-1 text-center sm:text-start">
              <h3 className="text-sm font-bold text-fg">
                عزل سحابي كامل وأمان فائق لقواعد البيانات (Tenant DB Isolation)
              </h3>
              <p className="text-xs text-fg-muted leading-relaxed">
                تحصل كل مؤسسة أو معلم مستقل على مساحة تخزين وقاعدة بيانات معزولة تماماً تضمن عدم تداخل
                البيانات أو تسرب سجلات الحضور والدرجات، مع التزام تام باللوائح والأنظمة.
              </p>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto space-y-6 pt-4">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-primary text-xs font-bold uppercase tracking-wider">
                <HelpCircle size={14} />
                <span>الأسئلة الشائعة</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-fg">كل ما تريد معرفته عن التسعير</h2>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Card className="p-5 bg-surface border-border space-y-2">
                <h4 className="text-sm font-bold text-fg">هل يدفع المعلم أو السنتر أي رسوم اشتراك؟</h4>
                <p className="text-xs text-fg-muted leading-relaxed">
                  لا، استخدام منصة سحابة مجاني بالكامل لكافة المعلمين والمراكز التعليمية والمدارس. لا توجد رسوم
                  إعداد أو اشتراكات شهرية على المؤسسة.
                </p>
              </Card>

              <Card className="p-5 bg-surface border-border space-y-2">
                <h4 className="text-sm font-bold text-fg">كيف يتم سداد اشتراك الطالب الشهري؟</h4>
                <p className="text-xs text-fg-muted leading-relaxed">
                  يقوم الطالب أو ولي أمره برفع إشعار التحويل البنكي (10 ريال) عبر حسابه في المنصة، وتتم
                  مراجعة المعاملة وتأكيدها مركزياً عبر إدارة المنصة لتفعيل الشهر فورياً.
                </p>
              </Card>

              <Card className="p-5 bg-surface border-border space-y-2">
                <h4 className="text-sm font-bold text-fg">هل يسدد طالب السنتر (الأوفلاين) نفس الرسوم؟</h4>
                <p className="text-xs text-fg-muted leading-relaxed">
                  نعم، يحصل طالب السنتر الأوفلاين على نفس الرسوم الرمزية للوصول لكارت الحضور الذكي بالـ QR،
                  ومتابعة حل الواجبات ورصد درجات الكويزات الدورية، وتنبيهات ولي الأمر الفورية.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PublicPage>
  );
}
