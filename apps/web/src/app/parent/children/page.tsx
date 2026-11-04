'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../lib/education-api';
import { analyticsApi } from '../../../lib/analytics-api';
import type { Student, StudentAnalyticsSnapshot } from '../../../types';
import { PageHeader } from '../../../components/ui/page-header';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { EmptyState } from '../../../components/ui/empty-state';
import { SearchIcon, CalendarIcon, AwardIcon, IconNext } from '../../../components/icons';

import { Search, Users } from 'lucide-react';
import { formatNumber, formatPercent } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
interface ChildCardData {
  student: Student;
  snapshot: StudentAnalyticsSnapshot | null;
}

export default function ParentChildrenDirectoryPage() {
  const [childrenData, setChildrenData] = useState<ChildCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadChildren = async () => {
      try {
        setLoading(true);
        const list = await educationApi.getMyChildren();

        const enriched = await Promise.all(
          list.map(async (st) => {
            const snap = await analyticsApi.getStudentDashboard(st.id).catch(partial(null));
            return { student: st, snapshot: snap };
          })
        );

        setChildrenData(enriched);
      } finally {
        setLoading(false);
      }
    };

    loadChildren();
  }, []);

  const filteredChildren = childrenData.filter((item) => {
    const name = item.student.user?.name || '';
    const code = item.student.student_code || '';
    const query = searchQuery.trim().toLowerCase();
    return name.toLowerCase().includes(query) || code.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <PageHeader
        title="الملف الأكاديمي الشامل للأبناء"
        description="استعرض السجل الأكاديمي، كشف الدرجات التفصيلي، وسجل الحضور والغياب لكل ابن مسجل بالأكاديمية."
        breadcrumbs={[
          { label: 'لوحة التحكم', href: '/parent/dashboard' },
          { label: 'سجل الأبناء' },
        ]}
      />

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-surface rounded-lg border border-border shadow-xs">
        <div className="relative w-full sm:w-80">
          <SearchIcon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود الأكاديمي..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-md ps-9 pe-3 py-2 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-xs text-fg-muted">
          إجمالي الأبناء المسجلين:{' '}
          <strong className="font-mono text-fg font-bold">{formatNumber(childrenData.length)}</strong>
        </div>
      </div>

      {/* Main Content State */}
      {loading ? (
        <div className="py-20 text-center text-fg-muted text-xs">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل السجلات الأكاديمية للأبناء...</p>
        </div>
      ) : childrenData.length === 0 ? (
        <Card className="p-12 text-center bg-surface border border-border">
          <EmptyState
            icon={<Users size={20} strokeWidth={1.75} aria-hidden />}
            title="لا يوجد طلاب مسجلون"
            description="لم يتم ربط أي طالب بحسابك حالياً. يرجى التواصل مع إدارة المدرسة أو المركز لربط رقم الهوية."
          />
        </Card>
      ) : filteredChildren.length === 0 ? (
        <Card className="p-12 text-center bg-surface border border-border">
          <EmptyState
            icon={<Search size={20} strokeWidth={1.75} aria-hidden />}
            title="لا توجد نتائج بحث"
            description="لم نجد أي طالب يطابق معايير البحث المدخلة."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChildren.map(({ student, snapshot }) => {
            const overallScore = snapshot?.overall_score ?? null;
            const attendanceRate = snapshot?.attendance_rate ?? null;
            const assignmentRate = snapshot?.assignment_completion_rate ?? null;
            const examAverage = snapshot?.exam_average ?? null;

            return (
              <Card
                key={student.id}
                className="p-5 bg-surface border border-border shadow-xs hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary-subtle text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/20">
                        {(student.user?.name || 'ط').charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-fg">
                          {student.user?.name || `طالب (${student.student_code})`}
                        </h3>
                        <p className="text-xs text-fg-muted mt-0.5">
                          كود الطالب:{' '}
                          <span className="font-mono text-fg font-semibold">{student.student_code}</span>
                        </p>
                      </div>
                    </div>

                    <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
                      {student.status === 'active' ? 'منتظم' : student.status}
                    </Badge>
                  </div>

                  {/* Level & Contact */}
                  <div className="py-3 text-xs text-fg-muted flex items-center justify-between border-b border-border/60">
                    <span>المرحلة الدراسية:</span>
                    <strong className="text-fg font-semibold">
                      {student.grade_level || 'الصف الدراسي المسجل'}
                    </strong>
                  </div>

                  {/* Metrics Grid */}
                  <div className="py-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-fg-muted flex items-center gap-1.5">
                          <AwardIcon size={14} className="text-primary" />
                          <span>المعدل العام الموزون</span>
                        </span>
                        <span className="font-mono font-bold text-fg">{formatPercent(overallScore)}</span>
                      </div>
                      <ProgressBar
                        value={Number(overallScore ?? 0)}
                        variant={overallScore === null || overallScore >= 50 ? (overallScore !== null && overallScore >= 80 ? 'success' : 'primary') : 'danger'}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-fg-muted flex items-center gap-1.5">
                          <CalendarIcon size={14} className="text-primary" />
                          <span>نسبة الحضور المعتمدة</span>
                        </span>
                        <span className="font-mono font-bold text-fg">{formatPercent(attendanceRate)}</span>
                      </div>
                      <ProgressBar
                        value={Number(attendanceRate ?? 0)}
                        variant={attendanceRate === null ? 'primary' : attendanceRate >= 75 ? 'success' : 'danger'}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-fg-muted">
                      <div className="p-2 rounded-md bg-surface-sunken border border-border">
                        <span className="block text-xs">إنجاز الواجبات</span>
                        <strong className="font-mono text-fg text-xs">{formatPercent(assignmentRate)}</strong>
                      </div>
                      <div className="p-2 rounded-md bg-surface-sunken border border-border">
                        <span className="block text-xs">متوسط الاختبارات</span>
                        <strong className="font-mono text-fg text-xs">{formatPercent(examAverage)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-4 border-t border-border">
                  <Link
                    href={`/parent/children/${student.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
                  >
                    <span>فتح الملف الأكاديمي المفصل</span>
                    <IconNext size={13}  />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
