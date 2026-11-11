'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { educationApi } from '../../../lib/education-api';
import { assessmentApi } from '../../../lib/assessment-api';
import type { Course, Exam } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { PageHeader } from '../../../components/ui/page-header';
import { buttonClasses } from '../../../components/ui/button-styles';
import { AwardIcon, ClockIcon } from '../../../components/icons';
import { GraduationCap } from 'lucide-react';
import { formatNumber } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
import { mapWithConcurrency } from '../../../lib/concurrency';

/**
 * Exam directory. Exams are NOT taken here: each one opens in its own secure, full-page session
 * (/exam/[courseId]/[examId]) with a briefing, fullscreen, server timer and integrity logging.
 */
export default function StudentExamsPage() {
  const [exams, setExams] = useState<{ course: Course; item: Exam }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadExams = async () => {
      try {
        setLoading(true);
        const courses = await educationApi.getCourses();
        const all: { course: Course; item: Exam }[] = [];
        const lists = await mapWithConcurrency(courses, 4, async (course) => ({
          course,
          list: await assessmentApi.getExams(course.id).catch(partial([])),
        }));
        for (const { course, list } of lists) for (const exam of list) all.push({ course, item: exam });
        setExams(all);
      } finally {
        setLoading(false);
      }
    };
    loadExams();
  }, []);

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="الاختبارات الإلكترونية"
        subtitle="يُجرى كل اختبار في صفحة مستقلة مؤمَّنة بوقت محدد وإجراءات صارمة."
        actions={<Badge variant="success">إجمالي الاختبارات: {formatNumber(exams.length)}</Badge>}
      />

      <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-subtle p-4 text-sm text-primary-subtle-fg">
        <ShieldCheck size={20} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          قبل البدء ستظهر لك تعليمات الاختبار، ثم يُفتح في وضع ملء الشاشة. الخروج منه أو مغادرة الصفحة يُسجَّل كمخالفة. جهّز جهازًا مشحونًا واتصالًا مستقرًا.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-fg-muted">
          <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>جارٍ التحميل...</p>
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={20} strokeWidth={1.75} aria-hidden />}
          title="لا توجد اختبارات مجدولة"
          description="لا توجد اختبارات إلكترونية مجدولة في مقرراتك حاليًا."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {exams.map(({ course, item }) => (
            <Card key={item.id} className="flex flex-col border-border bg-surface p-6 shadow-xs transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between gap-2">
                <span className="max-w-[60%] truncate rounded-xs border border-primary/20 bg-primary-subtle px-2 py-0.5 font-mono text-xs font-bold text-primary">{course.code}</span>
                <Badge variant="info">اختبار إلكتروني</Badge>
              </div>
              <h3 className="mt-3 break-words text-base font-bold text-fg">{item.title}</h3>
              <p className="mt-1 break-words text-xs text-fg-muted">المقرر: {course.title}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                <span className="flex items-center gap-1">
                  <ClockIcon size={14} /> المدة: {formatNumber(item.duration_minutes || 60)} دقيقة
                </span>
                {item.allow_split_sessions && <span className="rounded-xs bg-primary-subtle px-2 py-0.5 font-semibold text-primary">يُحَل على أكثر من جلسة</span>}
                <span className="flex items-center gap-1">
                  <AwardIcon size={14} className="text-primary" /> الدرجة: {formatNumber(item.total_points || 100)}
                </span>
              </div>
              <div className="mt-auto border-t border-border pt-4">
                <Link href={`/exam/${course.id}/${item.id}`} className={`${buttonClasses('primary', 'md')} mt-2 w-full`}>
                  فتح صفحة الاختبار
                </Link>
                <Link href={`/student/model-answers/exams/${course.id}/${item.id}`} className={`${buttonClasses('ghost', 'sm')} mt-2 w-full`}>
                  الحل النموذجي
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
