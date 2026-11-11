'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpenIcon,
  CheckCircleIcon,
  PlayIcon,
  BookmarkIcon,
  BookmarkCheckIcon,
} from '../../../components/icons';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { Badge } from '../../../components/ui/badge';
import { useSavedVideos } from '../hooks/use-saved-videos';
import { formatPercent } from '../../../lib/format';
import type { Course, LessonProgressData, Lesson } from '../../../types';

export interface StudentCoursesSectionProps {
  userId?: string;
  courses: Course[];
  progressList?: Array<LessonProgressData & { lesson?: Lesson }>;
}

const levelLabels: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

export const StudentCoursesSection: React.FC<StudentCoursesSectionProps> = ({
  userId,
  courses,
  progressList = [],
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'in_progress' | 'completed'>('all');
  const { isSaved, toggleVideo } = useSavedVideos(userId);

  // Compute progress details for each course
  const courseData = useMemo(() => {
    const map = new Map<
      string,
      { totalLessons: number; completedCount: number; percent: number; isCompleted: boolean }
    >();

    const lessonProgressMap = new Map<string, { completed: boolean; percent: number }>();
    progressList.forEach((p) => {
      if (p.lesson?.id) {
        lessonProgressMap.set(p.lesson.id, {
          completed: !!p.completed_at || (p.percent || 0) >= 100,
          percent: p.percent || 0,
        });
      }
    });

    courses.forEach((c) => {
      const lessons = c.lessons || [];
      const totalLessons = lessons.length;
      let completedCount = 0;
      let totalPercent = 0;

      lessons.forEach((l) => {
        const prog = lessonProgressMap.get(l.id);
        if (prog) {
          if (prog.completed) completedCount++;
          totalPercent += prog.percent;
        }
      });

      let percent = 0;
      if (totalLessons > 0) {
        percent = Math.min(100, Math.round((completedCount / totalLessons) * 100));
      } else if (lessons.length === 0 && totalPercent > 0) {
        percent = Math.min(100, Math.round(totalPercent));
      }

      const isCompleted = (totalLessons > 0 && completedCount >= totalLessons) || percent >= 100;

      map.set(c.id, {
        totalLessons,
        completedCount,
        percent,
        isCompleted,
      });
    });

    return map;
  }, [courses, progressList]);

  // Filter courses by tab
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const info = courseData.get(c.id) || { percent: 0, isCompleted: false };
      if (activeTab === 'completed') {
        return info.isCompleted;
      }
      if (activeTab === 'in_progress') {
        return !info.isCompleted;
      }
      return true;
    });
  }, [courses, courseData, activeTab]);

  // Counts
  const counts = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    courses.forEach((c) => {
      const info = courseData.get(c.id);
      if (info?.isCompleted) {
        completed++;
      } else {
        inProgress++;
      }
    });
    return { all: courses.length, inProgress, completed };
  }, [courses, courseData]);

  return (
    <div className="space-y-4">
      {/* Section Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-fg">الكورسات والمناهج المشترك بها</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-subtle text-primary border border-primary/20">
              بيانات حقيقية
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-0.5">
            تابع كورساتك الحالية، استكمل متطلبات التخرج، واحتفل بالكورسات المكتملة
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-md bg-surface-raised border border-border text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-surface text-fg font-bold shadow-2xs'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            جميع الكورسات ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('in_progress')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeTab === 'in_progress'
                ? 'bg-surface text-fg font-bold shadow-2xs'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            كورساتك الحالية ({counts.inProgress})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-surface text-fg font-bold shadow-2xs'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            كورسات مكتملة ({counts.completed})
          </button>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const info = courseData.get(course.id) || {
              totalLessons: 0,
              completedCount: 0,
              percent: 0,
              isCompleted: false,
            };
            const teacherName = course.teacher?.user?.name || 'مدرس المادة';
            const firstLesson = course.lessons?.[0];

            return (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-lg border border-border bg-surface hover:border-primary/40 hover:shadow-sm transition-all p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-mono font-bold text-primary bg-primary-subtle px-2 py-0.5 rounded border border-primary/20">
                      {course.code}
                    </span>
                    {info.isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success-subtle px-2 py-0.5 rounded-full border border-success/20">
                        <CheckCircleIcon size={12} />
                        مكتمل بنجاح
                      </span>
                    ) : info.percent > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary-subtle px-2 py-0.5 rounded-full">
                        <PlayIcon size={11} />
                        قيد التقدم ({formatPercent(info.percent)})
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-fg-muted bg-surface-raised px-2 py-0.5 rounded-full">
                        لم تبدأ بعد
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-fg leading-snug hover:text-primary transition-colors">
                    <Link href={`/student/courses/${course.id}`}>{course.title}</Link>
                  </h3>

                  {course.description && (
                    <p className="text-xs text-fg-muted mt-1.5 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  )}

                  <div className="mt-3.5 flex items-center gap-2 text-xs text-fg-muted">
                    <span className="font-medium text-fg">{teacherName}</span>
                    <span>•</span>
                    <span>{info.totalLessons} دروس مسجلة</span>
                    {course.level && (
                      <>
                        <span>•</span>
                        <span>{levelLabels[course.level] || course.level}</span>
                      </>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-border/60">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-fg-muted">
                        نسبة الإنجاز ({info.completedCount}/{info.totalLessons} درس)
                      </span>
                      <span className="font-bold text-fg">{formatPercent(info.percent)}</span>
                    </div>
                    <ProgressBar
                      value={info.percent}
                      variant={info.isCompleted ? 'success' : 'primary'}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <Link href={`/student/courses/${course.id}`} className="flex-1">
                    <button
                      type="button"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-semibold bg-primary text-primary-fg hover:bg-primary-hover transition-colors shadow-2xs"
                    >
                      {info.isCompleted ? (
                        <>
                          <CheckCircleIcon size={13} />
                          <span>مراجعة الكورس</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon size={13} />
                          <span>متابعة التعلم</span>
                        </>
                      )}
                    </button>
                  </Link>

                  {firstLesson && (
                    <button
                      type="button"
                      onClick={() =>
                        toggleVideo({
                          id: firstLesson.id,
                          lessonId: firstLesson.id,
                          lessonTitle: firstLesson.title,
                          courseId: course.id,
                          courseTitle: course.title,
                          courseCode: course.code,
                          durationMinutes: firstLesson.duration_minutes || 45,
                          savedAt: new Date().toISOString(),
                        })
                      }
                      title={isSaved(firstLesson.id) ? 'إزالة من المحفوظات' : 'حفظ درس من هذا المقرر'}
                      className={`p-2 rounded-md border transition-colors ${
                        isSaved(firstLesson.id)
                          ? 'border-warning/30 bg-warning-subtle text-warning'
                          : 'border-border bg-surface hover:bg-surface-raised text-fg-muted hover:text-fg'
                      }`}
                    >
                      {isSaved(firstLesson.id) ? (
                        <BookmarkCheckIcon size={15} />
                      ) : (
                        <BookmarkIcon size={15} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <div className="w-10 h-10 mx-auto rounded-full bg-primary-subtle text-primary flex items-center justify-center mb-2.5">
            <BookOpenIcon size={20} />
          </div>
          <h3 className="text-sm font-bold text-fg">
            {activeTab === 'completed'
              ? 'لا توجد كورسات مكتملة بعد'
              : activeTab === 'in_progress'
              ? 'لا توجد كورسات قيد التقدم'
              : 'لم تشترك في أي مقرر حتى الآن'}
          </h3>
          <p className="text-xs text-fg-muted mt-1 max-w-sm mx-auto">
            {activeTab === 'completed'
              ? 'استمر في استكمال دروسك واختباراتك لتظهر المقررات المكتملة هنا بشهادات إتمامك.'
              : 'يمكنك استعراض دليل المناهج المتاحة والاشتراك في مقررات دراسية جديدة.'}
          </p>
          <div className="mt-4">
            <Link href="/student/courses">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors"
              >
                <BookOpenIcon size={14} />
                <span>دليل المقررات الدراسية</span>
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
