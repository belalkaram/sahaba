'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { educationApi } from '../../../lib/education-api';
import type { Course } from '../../../types';
import { BookOpenIcon, ClockIcon, SearchIcon, PlusIcon, EditIcon } from '../../../components/icons';

import { X } from 'lucide-react';
export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');

  // Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newLevel, setNewLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [newIsFree, setNewIsFree] = useState(false);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await educationApi.getCourses();
      setCourses(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'تعذر تحميل قائمة المقررات الدراسية.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setSubmitting(true);
      const created = await educationApi.createCourse({
        title: newTitle.trim(),
        code: newCode.trim() || undefined,
        description: newDesc.trim() || undefined,
        level: newLevel,
        is_free: newIsFree,
        status: 'draft',
      });
      setNewTitle('');
      setNewCode('');
      setNewDesc('');
      setIsCreating(false);
      await loadCourses();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || 'حدث خطأ أثناء إنشاء المقرر.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (course: Course) => {
    const isCurrentlyPublished = course.status === 'published';
    const actionName = isCurrentlyPublished ? 'إلغاء نشر' : 'نشر';
    if (!confirm(`هل أنت متأكد من ${actionName} مقرر "${course.title}"؟`)) return;

    try {
      if (isCurrentlyPublished) {
        await educationApi.unpublishCourse(course.id);
      } else {
        await educationApi.publishCourse(course.id);
      }
      await loadCourses();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || `تعذر ${actionName} المقرر.`);
    }
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.code && course.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && course.status === 'published') ||
        (statusFilter === 'draft' && (course.status === 'draft' || !course.status)) ||
        (statusFilter === 'archived' && course.status === 'archived');

      return matchesSearch && matchesStatus;
    });
  }, [courses, searchQuery, statusFilter]);

  const levelLabels: Record<string, string> = {
    beginner: 'مبتدئ',
    intermediate: 'متوسط',
    advanced: 'متقدم',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpenIcon size={24} className="text-primary" />
            إدارة المقررات والمحتوى التعليمي
          </h1>
          <p className="text-sm text-secondary mt-1">
            أنشئ مقرراتك، نظّم المحاضرات والوحدات التدريبية عبر Course Builder، وتابع نسب إنجاز الطلاب.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-4 py-2.5 rounded-lg text-xs transition-opacity shadow-md shadow-primary/20 shrink-0"
        >
          <PlusIcon size={16} />
          إنشاء مقرر دراسي جديد
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <SearchIcon size={16} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg ps-9 pe-3 py-2 text-xs text-foreground placeholder:text-secondary/60 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div tabIndex={0} className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { key: 'all', label: 'الكل' },
              { key: 'published', label: 'منشور' },
              { key: 'draft', label: 'مسودة' },
              { key: 'archived', label: 'مؤرشف' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-[12px] text-xs font-medium transition-all ${
                statusFilter === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-secondary hover:text-foreground hover:bg-background'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center text-secondary text-sm">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mb-3" />
          <p>جارٍ تحميل المقررات التعليمية...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredCourses.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-card border border-border">
          <BookOpenIcon size={40} className="mx-auto text-secondary/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">لا توجد مقررات دراسية</h3>
          <p className="text-xs text-secondary mt-1">
            {searchQuery || statusFilter !== 'all'
              ? 'لا توجد نتائج تطابق معايير البحث الحالية.'
              : 'ابدأ الآن بإنشاء مقررك الأول وإضافة الوحدات والدروس.'}
          </p>
          {(!searchQuery && statusFilter === 'all') && (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-4 py-2 rounded-lg text-xs hover:opacity-90"
            >
              <PlusIcon size={14} />
              إضافة مقرر جديد
            </button>
          )}
        </div>
      )}

      {/* Courses Cards Grid */}
      {!loading && !error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const isPublished = course.status === 'published';
            const modulesCount = course.modules?.length ?? 0;
            const lessonsCount = course.lessons?.length ?? 0;

            return (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-2xl bg-card border border-border p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all group"
              >
                <div>
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-primary px-2.5 py-1 rounded-sm bg-[color-mix(in_srgb,var(--pri)_10%,transparent)] border border-primary/20">
                      {course.code || 'NO-CODE'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {course.is_free ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          مجاني
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                          باقة اشتراك
                        </span>
                      )}
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isPublished
                            ? 'bg-success/10 text-success border border-success/20'
                            : 'bg-surface-muted/10 text-fg-muted border border-border-strong/20'
                        }`}
                      >
                        {isPublished ? 'منشور' : 'مسودة'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {course.title}
                  </h3>
                  <p className="text-xs text-secondary mt-1.5 line-clamp-2 leading-relaxed h-8">
                    {course.description || 'لا يوجد وصف مضاف لهذا المقرر بعد.'}
                  </p>

                  {/* Meta stats */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60 text-xs text-secondary">
                    <div className="flex items-center gap-1.5">
                      <BookOpenIcon size={14} className="text-secondary/60" />
                      <span>{modulesCount} وحدات دراسية</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ClockIcon size={14} className="text-secondary/60" />
                      <span>{lessonsCount} محاضرة / درس</span>
                    </div>
                  </div>

                  {course.level && (
                    <div className="mt-2 text-xs text-secondary">
                      المستوى:{' '}
                      <span className="font-semibold text-foreground">
                        {levelLabels[course.level] || course.level}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-2">
                  <Link
                    href={`/teacher/courses/${course.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary hover:opacity-90 text-primary-foreground font-semibold px-3 py-2 rounded-lg text-xs transition-opacity shadow-sm"
                  >
                    <EditIcon size={14} />
                    إدارة المحتوى (Course Builder)
                  </Link>

                  <button
                    onClick={() => handleTogglePublish(course)}
                    title={isPublished ? 'إلغاء النشر وتحويل إلى مسودة' : 'نشر المقرر للطلبة'}
                    className={`px-3 py-2 rounded-[14px] text-xs font-semibold border transition-colors ${
                      isPublished
                        ? 'border-border text-secondary hover:text-foreground hover:bg-background'
                        : 'border-success/30 text-success bg-success/10 hover:bg-success/20'
                    }`}
                  >
                    {isPublished ? 'إلغاء النشر' : 'نشر'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Course Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BookOpenIcon size={18} className="text-primary" />
                إنشاء مقرر دراسي جديد
              </h2>
              <button
                onClick={() => setIsCreating(false)}
                className="text-secondary hover:text-foreground text-sm font-semibold p-1"
               aria-label="إغلاق">
                
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">
                  اسم المقرر <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فيزياء الميكانيكا والحركة"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">كود المقرر</label>
                  <input aria-label="كود المقرر"
                    type="text"
                    placeholder="مثال: PHYS-101"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary mb-1">المستوى</label>
                  <select aria-label="المستوى"
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="beginner">مبتدئ</option>
                    <option value="intermediate">متوسط</option>
                    <option value="advanced">متقدم</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary mb-1">وصف المقرر ومحاوره</label>
                <textarea aria-label="وصف المقرر ومحاوره"
                  rows={3}
                  placeholder="شرح موجز لمحتوى المقرر وأهدافه التعليمية..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground block">مقرر مجاني (متاح للجميع)</span>
                  <span className="text-xs text-secondary">
                    إذا تم التفعيل، يمكن لأي طالب مسجل الوصول للمحتوى بدون باقة اشتراك.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={newIsFree}
                  onChange={(e) => setNewIsFree(e.target.checked)}
                  className="w-4 h-4 rounded-xs text-primary focus:ring-primary accent-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs text-secondary hover:text-foreground hover:bg-background transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-semibold text-xs transition-opacity shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'جارٍ الإنشاء...' : 'حفظ وإنشاء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
