'use client';

import React from 'react';

import { Card } from '../../components/ui/card';



import { PublicPage } from '../../components/layout/public-chrome';
export default function TermsPage() {
  return (
    <PublicPage>
      <div className="py-12 px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        

        <div>
          <h1 className="text-3xl font-black text-fg">الشروط والأحكام وسياسة الاستخدام</h1>
          <p className="text-xs text-secondary mt-2">آخر تحديث: سبتمبر 2026</p>
        </div>

        <Card className="p-8 bg-card/60 border-border space-y-6 text-xs text-secondary leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-fg">1. مقدمة وقبول الشروط</h2>
            <p>
              تحكم هذه الشروط والأحكام استخدامك لمنظومة LMS السحابية لإدارة التعلم والمؤسسات التعليمية. باستخدامك لأي جزء من المنصة فإنك توافق على الالتزام الكامل بهذه الشروط.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-fg">2. عزل وحماية الحسابات والأجهزة</h2>
            <p>
              تطبق المنصة سياسة ربط الجهاز الواحد (Single Device Binding) لضمان عدم مشاركة الحسابات الأكاديمية أو تسريب المحتوى التعليمي. يتحمل المستخدم المسؤولية الكاملة عن سرية كلمة المرور وكود الوصول.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-fg">3. حقوق الملكية الفكرية للمحتوى</h2>
            <p>
              جميع المواد التعليمية والفيديوهات والاختبارات المرفوعة من قبل المؤسسات التعليمية تظل ملكية خاصة وحصرية لتلك المؤسسة، ولا تقوم المنصة بإعادة نشرها أو مشاركتها مع أي جهة ثالثة.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-bold text-fg">4. سياسة الاشتراكات والمدفوعات</h2>
            <p>
              يتم سداد الاشتراكات عبر القنوات المعتمدة لكل مؤسسة، وتخضع فترات الصلاحية للأطر الزمنية للباقة المحددة في النظام.
            </p>
          </section>
        </Card>
      </div>
    </div>
    </PublicPage>
  );
}
