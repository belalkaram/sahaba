'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { educationApi } from '../../../../lib/education-api';
import type { Course, Lesson } from '../../../../types';
import { DetailLayout } from '../../../../components/layout/detail-layout';
import { ProgressBar } from '../../../../components/ui/progress-bar';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  BookOpenIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  PlayIcon,
  VideoIcon,
  FileTextIcon,
  IconBack,
} from '../../../../components/icons'

import { BookOpen, PartyPopper } from 'lucide-react';
import { formatNumber, formatPercent } from '../../../../lib/format';
export default function StudentCourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourseOutline = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await educationApi.getCourseOutline(courseId);
      setCourse(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error_code?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل بيانات المقرر الدراسي.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourseOutline();
  }, [courseId]);

  // Aggregate lessons and progress
  const { allLessons, totalLessons, completedLessons, overallPercent, nextLesson } = useMemo(() => {
    if (!course?.modules) {
      return { allLessons: [], totalLessons: 0, completedLessons: 0, overallPercent: 0, nextLesson: null };
    }

    const lessonsList: Lesson[] = [];
    course.modules.forEach((mod) => {
      if (mod.lessons) {
        lessonsList.push(...mod.lessons);
      }
    });

    const total = lessonsList.length;
    const completed = lessonsList.filter((l) => Boolean(l.progress?.completed_at)).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Find next lesson to study: first unlocked incomplete lesson, or first unlocked lesson
    const firstIncomplete = lessonsList.find(
      (l) => (l.access?.allowed ?? (l.is_free_preview || course.is_free)) && !l.progress?.completed_at
    );
    const firstUnlocked = lessonsList.find(
      (l) => l.access?.allowed ?? (l.is_free_preview || course.is_free)
    );

    return {
      allLessons: lessonsList,
      totalLessons: total,
      completedLessons: completed,
      overallPercent: percent,
      nextLesson: firstIncomplete || firstUnlocked || null,
    };
  }, [course]);

  const levelLabels: Record<string, string> = {
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم',
  };

  const getLessonTypeIcon = (type?: string) => {
    switch (type) {
      case 'video':
        return <VideoIcon size={16} className="text-primary" />;
      case 'document':
      case 'text':
        return <FileTextIcon size={16} className="text-fg-muted" />;
      default:
        return <BookOpenIcon size={16} className="text-fg-muted" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} ثانية`;
    if (secs === 0) return `${mins} دقيقة`;
    return `${mins}:${secs.toString().padStart(2, '0')} دقيقة`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-fg-muted text-sm">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
        <p>جارٍ تحميل تفاصيل المقرر والوحدات التعليمية...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="p-8 rounded-lg bg-surface border border-border text-center max-w-lg mx-auto mt-12">
        <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-4 font-bold text-lg">
          !
        </div>
        <h3 className="text-base font-bold text-fg">تعذر فتح المقرر الدراسي</h3>
        <p className="text-xs text-fg-muted mt-1.5">{error || 'المقرر المطلوب غير موجود.'}</p>
        <Link
          href="/student/courses"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-fg text-xs font-semibold hover:bg-primary-hover transition-colors"
        >
          <IconBack size={14} />
          العودة للمقررات
        </Link>
      </div>
    );
  }

  const isCourseAllowed = course.access?.allowed ?? (course.is_free || false);

  const breadcrumbs = [
    { label: 'المقررات الدراسية', href: '/student/courses' },
    { label: course.title },
  ];

  const statusBadge = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs font-bold text-primary px-2.5 py-0.5 rounded-sm bg-primary-subtle border border-primary/20">
        {course.code || 'COURSE'}
      </span>
      {course.level && (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-raised text-fg-muted border border-border">
          {levelLabels[course.level] || course.level}
        </span>
      )}
      {course.is_free ? (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-success-subtle text-success border border-success/20">
          مقرر مجاني
        </span>
      ) : (
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-warning-subtle text-warning border border-warning/20">
          يتطلب باقة اشتراك
        </span>
      )}
    </div>
  );

  const sideSummary = (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted">موجز التقدم</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
          <span>نسبة الإنجاز</span>
          <span className="font-bold text-fg">{formatPercent(overallPercent)}</span>
        </div>
        <ProgressBar value={overallPercent} size="md" variant={overallPercent === 100 ? 'success' : 'primary'} />
        <div className="text-xs text-fg-muted flex justify-between pt-1">
          <span>{completedLessons} دروس مكتملة</span>
          <span>من أصل {totalLessons} درس</span>
        </div>
      </div>

      <div className="pt-2">
        {nextLesson ? (
          <Link
            href={`/student/courses/${course.id}/lessons/${nextLesson.id}`}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2.5 rounded-md text-xs transition-colors shadow-xs"
          >
            <PlayIcon size={14} />
            {completedLessons > 0 ? 'متابعة الدرس التالي' : 'ابدأ الدرس الأول'}
          </Link>
        ) : !isCourseAllowed ? (
          <Link
            href="/student/plans"
            className="w-full inline-flex items-center justify-center gap-2 bg-warning hover:bg-warning-hover text-warning-fg font-semibold px-4 py-2.5 rounded-md text-xs transition-colors shadow-xs"
          >
            <LockIcon size={14} />
            الترقية والاشتراك للوصول
          </Link>
        ) : (
          <div className="text-center text-xs font-semibold text-success bg-success-subtle py-2.5 rounded-md border border-success/20">
            
 <PartyPopper size={16} strokeWidth={1.75} aria-hidden /> لقد أتممت جميع دروس هذا المقرر بنجاح!
 </div>
        )}
      </div>

      {course.teacher?.user && (
        <div className="border-t border-border pt-3 mt-3">
          <span className="text-xs text-fg-muted block mb-1">المعلم المشرف:</span>
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <span className="w-6 h-6 rounded-full bg-primary-subtle text-primary font-bold flex items-center justify-center text-xs">
              {course.teacher.user.name?.[0] || 'م'}
            </span>
            <span>{course.teacher.user.name}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <DetailLayout
      breadcrumbs={breadcrumbs}
      title={course.title}
      subtitle={course.description || 'لا يوجد وصف تفصيلي مضاف لهذا المقرر.'}
      statusBadge={statusBadge}
      sideSummary={sideSummary}
    >
      {/* Syllabus Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-fg flex items-center gap-2">
            <BookOpenIcon size={18} className="text-primary" />
            المنهج الدراسي والوحدات التعليمية
          </h2>
          <span className="text-xs text-fg-muted">
            {course.modules?.length ?? 0} وحدات • {totalLessons} درس
          </span>
        </div>

        {(!course.modules || course.modules.length === 0) ? (
          <EmptyState
            icon={<BookOpen size={20} strokeWidth={1.75} aria-hidden />}
            title="لا توجد وحدات بعد"
            description="لم يتم رفع دروس أو وحدات لهذا المقرر بعد. سيقوم المعلم بنشر المحتوى قريباً."
          />
        ) : (
          <div className="space-y-4">
            {course.modules.map((module, modIdx) => {
              const moduleLessons = module.lessons || [];
              const modCompleted = moduleLessons.filter((l) => Boolean(l.progress?.completed_at)).length;

              return (
                <div
                  key={module.id}
                  className="rounded-lg bg-surface border border-border overflow-hidden shadow-xs"
                >
                  {/* Module Header */}
                  <div className="p-4 bg-surface-raised border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-sm bg-primary-subtle text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {modIdx + 1}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-fg">{module.title}</h3>
                        {module.description && (
                          <p className="text-xs text-fg-muted mt-0.5">{module.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-fg-muted font-medium shrink-0 self-end sm:self-center">
                      مكتمل: {modCompleted} / {formatNumber(moduleLessons.length)}
                    </div>
                  </div>

                  {/* Lessons in Module */}
                  <div className="divide-y divide-border">
                    {moduleLessons.length === 0 ? (
                      <div className="p-4 text-center text-xs text-fg-muted">لا توجد دروس داخل هذه الوحدة.</div>
                    ) : (
                      moduleLessons.map((lesson, lessonIdx) => {
                        const isUnlocked = lesson.access?.allowed ?? (lesson.is_free_preview || course.is_free);
                        const isCompleted = Boolean(lesson.progress?.completed_at);
                        const progressPercent = lesson.progress?.percent || 0;

                        return (
                          <div
                            key={lesson.id}
                            className={`p-3.5 sm:px-5 flex items-center justify-between gap-3 transition-colors ${
                              isUnlocked ? 'hover:bg-surface-raised cursor-pointer' : 'bg-surface-sunken/40 opacity-75'
                            }`}
                            onClick={() => {
                              if (isUnlocked) {
                                router.push(`/student/courses/${course.id}/lessons/${lesson.id}`);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-xs font-mono text-fg-muted shrink-0 w-5 text-center">
                                {lessonIdx + 1}
                              </span>

                              <div className="shrink-0">{getLessonTypeIcon(lesson.type)}</div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-semibold truncate ${
                                      isUnlocked ? 'text-fg hover:text-primary' : 'text-fg-muted'
                                    }`}
                                  >
                                    {lesson.title}
                                  </span>
                                  {lesson.is_free_preview && !course.is_free && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-success-subtle text-success border border-success/20 shrink-0">
                                      معاينة مجانية
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-fg-muted mt-0.5">
                                  {lesson.duration_seconds && (
                                    <span className="flex items-center gap-1">
                                      <ClockIcon size={12} />
                                      {formatDuration(lesson.duration_seconds)}
                                    </span>
                                  )}
                                  {lesson.materials && lesson.materials.length > 0 && (
                                    <span>{formatNumber(lesson.materials.length)} ملحقات ومذكرات</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status & Action Badge */}
                            <div className="flex items-center gap-2 shrink-0">
                              {isCompleted ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success-subtle px-2.5 py-1 rounded-full border border-success/20">
                                  <CheckCircleIcon size={13} />
                                  مكتمل
                                </span>
                              ) : progressPercent > 0 ? (
                                <span className="text-xs font-semibold text-primary bg-primary-subtle px-2.5 py-1 rounded-full border border-primary/20">
                                  {formatPercent(progressPercent)}
                                </span>
                              ) : null}

                              {isUnlocked ? (
                                <Link
                                  href={`/student/courses/${course.id}/lessons/${lesson.id}`}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-subtle text-primary hover:bg-primary hover:text-primary-fg transition-all"
                                  onClick={(e) => e.stopPropagation()}
                                  title="بدء الدرس"
                                >
                                  <PlayIcon size={14} />
                                </Link>
                              ) : (
                                <div className="flex items-center gap-1 text-xs font-semibold text-warning bg-warning-subtle px-2.5 py-1 rounded-full border border-warning/20">
                                  <LockIcon size={12} />
                                  يتطلب باقة
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DetailLayout>
  );
}
