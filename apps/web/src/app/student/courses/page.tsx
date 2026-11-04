'use client';

/**
 * R7B — Student Courses Catalog & Enrolled Courses Page
 * Built using Design System Primitives and Semantic Tokens.
 */

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../lib/education-api';
import type { Course, LessonProgressData, Lesson } from '../../../types';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';

import { PageHeader } from '../../../components/ui/page-header';
import { Tabs } from '../../../components/ui/tabs';
import { FilterBar } from '../../../components/ui/filter-bar';
import { Select } from '../../../components/ui/select';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { Avatar } from '../../../components/ui/avatar';
import { PlayIcon } from '../../../components/icons';

import { BookOpen } from 'lucide-react';
import { formatPercent } from '../../../lib/format';
import { partial } from '../../../lib/partial-failure';
const levelLabels: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
};

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressList, setProgressList] = useState<Array<LessonProgressData & { lesson?: Lesson }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'enrolled' | 'catalog'>('enrolled');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [coursesData, myProgress] = await Promise.all([
          educationApi.getCourses(),
          educationApi.getMyProgress().catch(partial([])),
        ]);

        setCourses(coursesData);
        setProgressList(myProgress);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message || 'تعذر تحميل المقررات الدراسية.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Compute progress by course
  const courseProgressMap = useMemo(() => {
    const map = new Map<string, { totalLessons: number; completedCount: number; avgPercent: number }>();
    const courseLessonProgress = new Map<string, { completed: number; totalPercent: number; count: number }>();

    progressList.forEach((p) => {
      const courseId = p.lesson?.course_id;
      if (!courseId) return;
      const current = courseLessonProgress.get(courseId) || { completed: 0, totalPercent: 0, count: 0 };
      if (p.completed_at) {
        current.completed += 1;
      }
      current.totalPercent += p.percent || 0;
      current.count += 1;
      courseLessonProgress.set(courseId, current);
    });

    courses.forEach((c) => {
      const totalLessons = c.lessons?.length || 0;
      const prog = courseLessonProgress.get(c.id);
      if (prog && totalLessons > 0) {
        const completedCount = prog.completed;
        const avg = Math.min(100, Math.round((completedCount / totalLessons) * 100));
        map.set(c.id, { totalLessons, completedCount, avgPercent: avg });
      } else if (prog && prog.count > 0) {
        map.set(c.id, {
          totalLessons: prog.count,
          completedCount: prog.completed,
          avgPercent: Math.round(prog.totalPercent / prog.count),
        });
      } else {
        map.set(c.id, { totalLessons, completedCount: 0, avgPercent: 0 });
      }
    });

    return map;
  }, [courses, progressList]);

  const enrolledCourses = useMemo(() => {
    return courses.filter((c) => {
      const hasProgress =
        (courseProgressMap.get(c.id)?.completedCount || 0) > 0 ||
        (courseProgressMap.get(c.id)?.avgPercent || 0) > 0;
      const isAllowed = c.access?.allowed ?? (c.is_free || false);
      return hasProgress || isAllowed;
    });
  }, [courses, courseProgressMap]);

  const displayedCourses = useMemo(() => {
    const list = activeTab === 'enrolled' ? enrolledCourses : courses;
    return list.filter((c) => {
      if (levelFilter !== 'all' && c.level !== levelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = c.title.toLowerCase().includes(q);
        const codeMatch = c.code ? c.code.toLowerCase().includes(q) : false;
        const teacherMatch = c.teacher?.user?.name
          ? c.teacher.user.name.toLowerCase().includes(q)
          : false;
        if (!titleMatch && !codeMatch && !teacherMatch) return false;
      }
      return true;
    });
  }, [activeTab, enrolledCourses, courses, levelFilter, searchQuery]);

  return (
    <div className="space-y-6 text-start">
      <PageHeader
        title="المقررات والمناهج الدراسية"
        description="استعرض مقرراتك المشترك بها، أو تصفح المناهج المتاحة وتابع تقدمك في الدروس المسجلة."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/student/dashboard' },
          { label: 'موادي الدراسية' },
        ]}
      />

      {error && (
        <div className="p-4 rounded-md bg-danger-subtle border border-danger/30 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter and Tab Bar */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs
            tabs={[
              { id: 'enrolled', label: `مقرراتي المشترك بها (${enrolledCourses.length})` },
              { id: 'catalog', label: `دليل كافة المقررات (${courses.length})` },
            ]}
            activeTab={activeTab}
            onChange={(t) => setActiveTab(t as any)}
          />

          <FilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="بحث بعنوان المقرر أو الكود أو اسم المعلم..."
            actions={
              <Select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'جميع المستويات' },
                  { value: 'beginner', label: 'مبتدئ' },
                  { value: 'intermediate', label: 'متوسط' },
                  { value: 'advanced', label: 'متقدم' },
                ]}
              />
            }
          />
        </div>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && displayedCourses.length === 0 && (
        <EmptyState
          title={activeTab === 'enrolled' ? 'لست مسجلاً في أي مقرر بعد' : 'لا توجد مقررات دراسية متاحة'}
          description={
            activeTab === 'enrolled'
              ? 'تصفح دليل المقررات المتاحة واختر ما يناسب خطتك الدراسية لتفعيل اشتراكك.'
              : 'لم يتم إضافة مقررات مطابقة لمعايير البحث الحالية.'
          }
          action={
            activeTab === 'enrolled'
              ? {
                  label: 'استعراض دليل المقررات',
                  onClick: () => setActiveTab('catalog'),
                }
              : undefined
          }
          icon={<BookOpen size={20} strokeWidth={1.75} aria-hidden />}
        />
      )}

      {/* Courses Grid */}
      {!loading && !error && displayedCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCourses.map((course) => {
            const progress = courseProgressMap.get(course.id) || {
              totalLessons: 0,
              completedCount: 0,
              avgPercent: 0,
            };
            const isCompleted = progress.avgPercent >= 100 && progress.totalLessons > 0;
            const hasAccess = course.access?.allowed ?? (course.is_free || false);

            return (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-lg bg-surface border border-border p-5 shadow-xs hover:border-primary/50 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-xs bg-primary-subtle border border-primary/20">
                      {course.code || 'LMS'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {course.is_free ? (
                        <Badge variant="success">مجاني</Badge>
                      ) : (
                        <Badge variant="warning">باقة اشتراك</Badge>
                      )}
                      {course.level && (
                        <Badge variant="neutral">
                          {levelLabels[course.level] || course.level}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-fg group-hover:text-primary transition-colors line-clamp-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-fg-muted mt-1.5 line-clamp-2 leading-relaxed h-8">
                    {course.description || 'استكشف محتويات هذا المقرر التعليمي وتابع دروسه.'}
                  </p>

                  {course.teacher?.user && (
                    <div className="mt-3 text-xs text-fg-muted flex items-center gap-2">
                      <Avatar name={course.teacher.user.name} size="xs" />
                      <span>المعلم: {course.teacher.user.name}</span>
                    </div>
                  )}

                  {hasAccess && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <div className="flex items-center justify-between text-xs font-medium text-fg-muted mb-1.5">
                        <span>نسبة الإنجاز</span>
                        <span className="font-bold text-fg font-mono">{formatPercent(progress.avgPercent)}</span>
                      </div>
                      <ProgressBar
                        value={progress.avgPercent}
                        variant={isCompleted ? 'success' : 'primary'}
                        size="sm"
                      />
                      <div className="mt-1.5 text-xs text-fg-subtle">
                        أكملت {progress.completedCount} من أصل {progress.totalLessons} درس
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border">
                  <Link
                    href={`/student/courses/${course.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-primary-fg font-semibold px-4 py-2.5 rounded-md text-xs transition-colors shadow-xs"
                  >
                    <PlayIcon size={14} />
                    <span>
                      {hasAccess
                        ? progress.avgPercent > 0
                          ? 'متابعة التعلم'
                          : 'بدء المقرر'
                        : 'عرض محتوى المقرر'}
                    </span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
