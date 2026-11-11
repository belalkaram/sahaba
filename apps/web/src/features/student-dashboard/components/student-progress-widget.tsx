'use client';

import React, { useMemo } from 'react';
import {
  GraduationCapIcon,
  CheckCircleIcon,
  ClockIcon,
  AwardIcon,
  BarChartIcon,
} from '../../../components/icons';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { formatPercent, pctValue } from '../../../lib/format';
import type { Course, LessonProgressData, Lesson, StudentAnalyticsSnapshot } from '../../../types';

export interface StudentProgressWidgetProps {
  snapshot: StudentAnalyticsSnapshot | null;
  courses: Course[];
  progressList?: Array<LessonProgressData & { lesson?: Lesson }>;
}

export const StudentProgressWidget: React.FC<StudentProgressWidgetProps> = ({
  snapshot,
  courses,
  progressList = [],
}) => {
  // Aggregate stats
  const progressStats = useMemo(() => {
    let totalLessonsCount = 0;
    let completedLessonsCount = 0;

    const lessonProgressMap = new Map<string, boolean>();
    progressList.forEach((p) => {
      if (p.lesson?.id && (p.completed_at || (p.percent || 0) >= 100)) {
        lessonProgressMap.set(p.lesson.id, true);
      }
    });

    const coursesBreakdown = courses.map((c) => {
      const lessons = c.lessons || [];
      const total = lessons.length;
      let completed = 0;
      lessons.forEach((l) => {
        if (lessonProgressMap.get(l.id)) completed++;
      });
      totalLessonsCount += total;
      completedLessonsCount += completed;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        total,
        completed,
        percent: pct,
      };
    });

    const overallCurriculumPercent =
      totalLessonsCount > 0
        ? Math.round((completedLessonsCount / totalLessonsCount) * 100)
        : Number(snapshot?.lesson_completion_rate ?? 0);

    return {
      totalLessonsCount,
      completedLessonsCount,
      overallCurriculumPercent,
      coursesBreakdown,
    };
  }, [courses, progressList, snapshot]);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-info-subtle text-info flex items-center justify-center">
            <BarChartIcon size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-fg">تقدمك الأكاديمي الشامل</h2>
            <p className="text-xs text-fg-muted mt-0.5">
              مؤشرات إتمام الدروس، معدل الحضور، ومتوسط درجات التقييمات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary-subtle text-primary border border-primary/20">
            <AwardIcon size={13} />
            المعدل العام: {pctValue(snapshot?.overall_score)}
          </span>
        </div>
      </div>

      {/* Top 3 KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-md bg-surface-raised/50 border border-border">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
            <span>إجمالي الدروس المنجزة</span>
            <CheckCircleIcon size={14} className="text-success" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-fg">
              {progressStats.completedLessonsCount}
            </span>
            <span className="text-xs text-fg-muted">من أصل {progressStats.totalLessonsCount} درس</span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={progressStats.overallCurriculumPercent}
              variant="success"
              size="sm"
            />
          </div>
        </div>

        <div className="p-3 rounded-md bg-surface-raised/50 border border-border">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
            <span>نسبة إتمام المناهج</span>
            <GraduationCapIcon size={14} className="text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-fg">
              {formatPercent(progressStats.overallCurriculumPercent)}
            </span>
            <span className="text-xs text-fg-muted">مكتمل حتى الآن</span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={progressStats.overallCurriculumPercent}
              variant="primary"
              size="sm"
            />
          </div>
        </div>

        <div className="p-3 rounded-md bg-surface-raised/50 border border-border">
          <div className="flex items-center justify-between text-xs text-fg-muted mb-1">
            <span>معدل الحضور والتفاعل</span>
            <ClockIcon size={14} className="text-info" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-fg">
              {pctValue(snapshot?.attendance_rate)}
            </span>
            <span className="text-xs text-fg-muted">حضور رسمي</span>
          </div>
          <div className="mt-2">
            <ProgressBar
              value={Number(snapshot?.attendance_rate ?? 0)}
              variant="primary"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Per Course Breakdown */}
      {progressStats.coursesBreakdown.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold text-fg">تفصيل التقدم حسب المقرر:</h3>
          <div className="space-y-2.5">
            {progressStats.coursesBreakdown.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-md border border-border bg-surface-raised/30 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-primary text-xs bg-primary-subtle px-1.5 py-0.5 rounded">
                      {item.code}
                    </span>
                    <span className="font-bold text-fg">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-fg-muted text-xs">
                      {item.completed} من {item.total} دروس
                    </span>
                    <span className="font-bold text-fg">{formatPercent(item.percent)}</span>
                  </div>
                </div>
                <ProgressBar
                  value={item.percent}
                  variant={item.percent >= 100 ? 'success' : 'primary'}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
