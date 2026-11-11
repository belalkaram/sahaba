'use client';

/**
 * R7B — Student Grades & Academic Record Page
 * Built using Design System Primitives and Semantic Tokens.
 */

import React, { useEffect, useState } from 'react';

import { useAuth } from '../../../context/auth-context';
import { assessmentApi } from '../../../lib/assessment-api';
import { analyticsApi } from '../../../lib/analytics-api';
import type { Grade, StudentAnalyticsSnapshot } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { PageHeader } from '../../../components/ui/page-header';
import { StatCard } from '../../../components/ui/stat-card';
import { EmptyState } from '../../../components/ui/empty-state';
import { SkeletonTable } from '../../../components/ui/skeleton';
import { AwardIcon, FileTextIcon, GraduationCapIcon } from '../../../components/icons';

import { CalendarDays, GraduationCap } from 'lucide-react';
import { formatNumber, formatPercent, pctValue } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
export default function StudentGradesPage() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<Grade[]>([]);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGrades = async () => {
      if (!user?.student?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [data, snap] = await Promise.all([
          assessmentApi.getStudentGrades(user.student.id).catch(partial([])),
          analyticsApi.getStudentDashboard(user.student.id).catch(partial(null)),
        ]);
        setGrades(data);
        if (snap) setSnapshot(snap);
      } finally {
        setLoading(false);
      }
    };
    loadGrades();
  }, [user]);

  const overallScore = snapshot?.overall_score ?? null;
  const gradeText =
    overallScore === null
      ? 'لم يُحسب بعد'
      : overallScore >= 90
      ? 'ممتاز'
      : overallScore >= 75
      ? 'جيد جداً'
      : overallScore >= 60
      ? 'جيد'
      : 'مقبول';

  const assignmentCount = grades.filter((g) =>
    g.gradable_type.toLowerCase().includes('assignment')
  ).length;
  const examCount = grades.filter(
    (g) =>
      g.gradable_type.toLowerCase().includes('exam') ||
      g.gradable_type.toLowerCase().includes('attempt')
  ).length;

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="كشف الدرجات والنتائج الأكاديمية"
        description="سجل رسمي شامل للدرجات المرصودة في الواجبات المنزلية والاختبارات الدورية مع التقدير العام."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/student/dashboard' },
          { label: 'درجاتي وشهاداتي' },
        ]}
        badge={
          <Badge variant={overallScore === null ? 'neutral' : overallScore >= 90 ? 'success' : overallScore >= 75 ? 'info' : 'warning'}>
            التقدير العام: {gradeText} ({formatPercent(overallScore)})
          </Badge>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="المعدل العام المركب"
          value={`${overallScore}%`}
          subtitle={`التقدير: ${gradeText}`}
          icon={<AwardIcon size={20} />}
          variant="purple"
        />
        <StatCard
          title="متوسط الاختبارات"
          value={pctValue(snapshot?.exam_average)}
          subtitle={`${examCount} اختبار تم تقييمه`}
          icon={<GraduationCapIcon size={20} />}
          variant="default"
        />
        <StatCard
          title="إنجاز الواجبات"
          value={pctValue(snapshot?.assignment_completion_rate)}
          subtitle={`${assignmentCount} واجب تم تسليمه`}
          icon={<FileTextIcon size={20} />}
          variant="emerald"
        />
        <StatCard
          title="نسبة الحضور"
          value={pctValue(snapshot?.attendance_rate)}
          subtitle="المجموعات الدراسية"
          icon={<CalendarDays size={20} strokeWidth={1.75} aria-hidden />}
          variant="lime"
        />
      </div>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : grades.length === 0 ? (
        <EmptyState
          title="لا توجد درجات مرصودة حالياً"
          description="لم يتم رصد أو نشر أي تقييمات رسمية لحسابك حتى الآن. استمر في تسليم الواجبات وأداء الاختبارات."
          action={{
            label: 'استعراض التقييمات والواجبات',
            onClick: () => {
              window.location.href = '/student/assessments';
            },
          }}
          icon={<GraduationCap size={20} strokeWidth={1.75} aria-hidden />}
        />
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-bold text-fg">قائمة التقييمات المرصودة رسمياً</h2>
            <span className="text-xs text-fg-muted font-mono">{formatNumber(grades.length)} تقييم</span>
          </div>

          <div tabIndex={0} className="overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full text-start border-collapse text-xs">
              <thead className="border-b border-border bg-surface-sunken text-fg-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">نوع التقييم</th>
                  <th className="py-3 px-4">الدرجة المحصلة</th>
                  <th className="py-3 px-4">الدرجة العظمى</th>
                  <th className="py-3 px-4">النسبة المئوية</th>
                  <th className="py-3 px-4">حالة الاعتماد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {grades.map((grade) => (
                  <tr key={grade.id} className="hover:bg-surface-raised transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-fg flex items-center gap-2">
                      <FileTextIcon size={14} className="text-primary" />
                      <span>
                        {grade.gradable_type.toLowerCase().includes('assignment')
                          ? 'واجب منزلي'
                          : 'اختبار دراسي'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-primary text-sm font-mono">
                      {grade.score}
                    </td>
                    <td className="py-3.5 px-4 text-fg-muted font-mono">{grade.max_score}</td>
                    <td className="py-3.5 px-4 font-bold text-fg font-mono">
                      {formatPercent(grade.percentage)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={grade.is_published ? 'success' : 'neutral'}>
                        {grade.is_published ? 'معتمد ومنشور' : 'قيد المراجعة'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
