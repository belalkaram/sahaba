'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';


import { Check } from 'lucide-react';
import { IconNext } from '../../components/icons/directional';
import { PublicPage } from '../../components/layout/public-chrome';
export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const plans = [
    {
      id: 'starter',
      name: 'باقة المراكز والسناتر (Starter)',
      description: 'مثالية للمراكز التعليمية، المعاهد المتوسطة، والمعلمين المستقلين.',
      monthlyPrice: '499',
      yearlyPrice: '399',
      features: [
        'قاعدة بيانات سحابية معزولة (1 Tenant DB)',
        'حتى 300 طالب نشط',
        'حضور وغياب بالـ QR Code المتجدد',
        'بنك أسئلة واختبارات مؤتمتة',
        'مشغل فيديو ومذكرات PDF',
        'ربط جهاز واحد لكل طالب (Single Device Binding)',
        'دعم فني عبر البريد وتذاكر المساعدة',
      ],
      ctaText: 'ابدأ تجربة المراكز',
      badge: 'الأنسب للمراكز',
      popular: false,
    },
    {
      id: 'pro',
      name: 'باقة المدارس والمعاهد (Professional)',
      description: 'الحل الشامل للمدارس الأهلية والدولية ومجمعات اللغات الكبرى.',
      monthlyPrice: '1,299',
      yearlyPrice: '999',
      features: [
        'جميع ميزات باقة المراكز',
        'حتى 1,500 طالب نشط',
        'فصول وبث مباشر متكامل (Google Meet / Zoom)',
        'لوحة متابعة شاملة لأولياء الأمور (Parent Portal)',
        'إدارة الفروع والقاعات والمساعدين (RBAC كامل)',
        'تحليلات تقدم أكاديمي سريعة (Fast-read Snapshots)',
        'نطاق مخصص خاص بالمدرسة (school.edu.sa)',
        'دعم فني مباشر عبر الهاتف والواتساب',
      ],
      ctaText: 'ابدأ تجربة المدارس المتقدمة',
      badge: 'الأكثر طلباً واكتمالاً',
      popular: true,
    },
    {
      id: 'enterprise',
      name: 'باقة الجامعات والأكاديميات (Enterprise)',
      description: 'حلول مخصصة للجامعات، الكليات، ومجموعات المدارس المتعددة.',
      monthlyPrice: 'مخصص',
      yearlyPrice: 'مخصص',
      features: [
        'جميع ميزات باقة المدارس',
        'عدد غير محدود من الطلاب والفصول',
        'نشر على خوادم سحابية خاصة (Dedicated VPC / On-Prem)',
        'تكامل كامل مع أنظمة SIS و ERP الحكومية',
        'مساعد تعليمي ذكي مخصص (AI Tutor Integration)',
        'اتفاقية مستوى الخدمة SLA 99.99%',
        'مدير حساب تقني مخصص على مدار الساعة',
      ],
      ctaText: 'طلب عرض سعر مخصص',
      badge: 'مؤسسي ضخم',
      popular: false,
    },
  ];

  return (
    <PublicPage>
      <div className="py-12 px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Navigation back */}
        

        {/* Heading */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="success" size="sm" className="mb-3">باقات واضحة وعادلة</Badge>
          <h1 className="text-3xl sm:text-5xl font-black text-fg">خطط أسعار تناسب حجم مؤسستك</h1>
          <p className="text-sm text-secondary mt-3 leading-relaxed">
            كل باقة تشتمل على عزل سحابي كامل لقاعدة البيانات وضمان عدم تداخل البيانات، مع تجربة مجانية لمدة 14 يوماً.
          </p>

          {/* Billing cycle toggle */}
          <div className="mt-8 inline-flex items-center bg-card border border-border p-1.5 rounded-xl">
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-[16px] text-xs font-semibold transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-primary text-primary-fg shadow-md'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              
 دفع سنوي (خصم 20%) 
 </button>
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-[16px] text-xs font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-primary text-primary-fg shadow-md'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              دفع شهري
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {plans.map((p) => (
            <Card
              key={p.id}
              className={`p-8 relative flex flex-col justify-between transition-all ${
                p.popular
                  ? 'border-primary/60 bg-[color-mix(in_srgb,var(--pri)_15%,transparent)] shadow-xl shadow-primary/10 scale-105'
                  : 'border-border-strong bg-card/40 hover:border-border-strong'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant={p.popular ? 'success' : 'neutral'}>{p.badge}</Badge>
                </div>
                <h3 className="text-lg font-bold text-fg">{p.name}</h3>
                <p className="text-xs text-secondary mt-1 min-h-[32px]">{p.description}</p>

                <div className="mt-6 mb-6 pb-6 border-b border-border">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-fg">
                      {billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice}
                    </span>
                    {p.yearlyPrice !== 'مخصص' && (
                      <span className="text-xs text-secondary font-medium">ر.س / شهر</span>
                    )}
                  </div>
                  {billingCycle === 'yearly' && p.yearlyPrice !== 'مخصص' && (
                    <span className="text-xs text-primary block mt-1">تُدفع سنوياً مع شهرين مجاناً</span>
                  )}
                </div>

                <div className="space-y-3">
                  <span className="text-xs font-bold text-secondary uppercase tracking-wider block">
                    المميزات المضمنة:
                  </span>
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-secondary">
                      <span className="text-primary text-sm mt-0.5"><Check size={16} strokeWidth={1.75} aria-hidden /></span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href="/register-school"
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-[16px] font-bold text-xs transition-all active:scale-95 ${
                    p.popular
                      ? 'bg-primary hover:bg-primary-hover text-primary-fg shadow-lg shadow-primary/30'
                      : 'bg-surface-muted hover:bg-background hover:border-border hover:border text-fg'
                  }`}
                >
                  {p.ctaText}  <IconNext size={16} />
 </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
    </PublicPage>
  );
}
