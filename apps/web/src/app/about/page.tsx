'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ShieldIcon, GraduationCapIcon } from '../../components/icons';



import { PublicPage } from '../../components/layout/public-chrome';
export default function AboutPage() {
  return (
    <PublicPage>
      <div className="py-12 px-6 relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10 space-y-12">
        

        <div className="text-center space-y-4">
          <Badge variant="success">عن المنصة ورؤيتنا</Badge>
          <h1 className="text-3xl sm:text-5xl font-black text-fg">
            بناء مستقبل التعليم السحابي في المنطقة العربية
          </h1>
          <p className="text-sm text-secondary max-w-2xl mx-auto leading-relaxed">
            انطلقت منصة LMS السحابية لتكون الحل التقني المتكامل للمدارس، المعاهد، ومراكز التدريب لتمكين التعليم الهجين والتعليم الذكي وفق أعلى معايير الأمان وعزل البيانات.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 bg-card/50 border-border space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ShieldIcon size={20} />
            </div>
            <h2 className="text-base font-bold text-fg">الخصوصية والعزل التام للمؤسسات</h2>
            <p className="text-xs text-secondary leading-relaxed">
              نؤمن بأن بيانات الطلاب والمؤسسات التعليمية خط أحمر، لذلك صممنا النظام بمعمارية Multi-Tenant حقيقية تمنح كل مؤسسة قاعدة بيانات منفصلة تماماً ومفاتيح تشفير مستقلة.
            </p>
          </Card>

          <Card className="p-6 bg-card/50 border-border space-y-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <GraduationCapIcon size={20} />
            </div>
            <h2 className="text-base font-bold text-fg">الدمج بين الحضور الميداني والافتراضي</h2>
            <p className="text-xs text-secondary leading-relaxed">
              لا نكتفي بكوننا منصة كورسات مسجلة، بل ندمج العمليات اليومية: من تسجيل حضور القاعات بالأكواد الذكية، إدارة تسليمات الواجبات، ومتابعة أولياء الأمور إلى الفصول الافتراضية المباشرة.
            </p>
          </Card>
        </div>

        <div className="p-8 rounded-2xl bg-card/40 border border-border text-center space-y-4">
          <h3 className="text-lg font-bold text-fg">هل ترغب في انضمام مؤسستك إلينا؟</h3>
          <p className="text-xs text-secondary max-w-lg mx-auto">
            تواصل مع فريقنا الفني للحصول على عرض توضيحي حي مخصص لمدرستك أو مركزك التدريبي.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/register-school"
              className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary text-primary-fg font-bold text-xs shadow-lg shadow-primary/30 transition-all"
            >
              ابدأ الآن مجاناً
            </Link>
            <Link
              href="/contact"
              className="px-6 py-2.5 rounded-lg bg-card border-border border hover:bg-background hover:border-border hover:border text-fg font-semibold text-xs border border-border transition-all"
            >
              تواصل مع المبيعات
            </Link>
          </div>
        </div>
      </div>
    </div>
    </PublicPage>
  );
}
