'use client';

import React, { useState } from 'react';
import { PlusIcon } from '../../../components/icons';
import { Button } from '../../../components/ui/button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { DataState } from '../../../components/ui/data-state';
import { PageHeader } from '../../../components/ui/page-header';
import { useCan } from '../../../hooks/useCan';
import { usePagedList } from '../../../hooks/use-paged-list';
import { assessmentApi } from '../../../lib/assessment-api';
import { assessmentOverviewApi, EMPTY_FILTERS, type CourseOption, type ExamOverviewRow, type ExamOverviewSummary } from '../../../lib/assessment-overview-api';
import { formatNumber } from '../../../lib/format';
import { CreateExamForm, describeCreateError } from '../../../features/assessment/create-exam-form';
import { ExamOverviewCard } from '../../../features/assessment/overview/exam-overview-card';
import { OverviewFilters } from '../../../features/assessment/overview/overview-filters';
import { AssessmentTabs, KpiFilterButton } from '../../../features/assessment/overview/overview-parts';

const STATUS_OPTIONS = [
  { value: 'published', label: 'منشور' },
  { value: 'draft', label: 'مسودة' },
  { value: 'closed', label: 'مغلق' },
  { value: 'archived', label: 'مؤرشف' },
];
const NEEDS_OPTIONS = [
  { value: 'pending_grading', label: 'بانتظار التصحيح' },
  { value: 'in_progress', label: 'طلاب يحلون الآن' },
  { value: 'open_now', label: 'متاح الآن' },
  { value: 'no_participation', label: 'منشور ولم يدخله أحد' },
  { value: 'grades_unpublished', label: 'درجات غير منشورة' },
  { value: 'violations', label: 'فيه مخالفات' },
];
const SORT_OPTIONS = [
  { value: '', label: 'الأحدث أولًا' },
  { value: 'oldest', label: 'الأقدم أولًا' },
  { value: 'pending', label: 'الأكثر انتظارًا للتصحيح' },
  { value: 'participation', label: 'الأكثر تسليمًا' },
  { value: 'title', label: 'حسب العنوان' },
];

export default function TeacherExamsPage() {
  const canCreate = useCan('exams.create');
  const canGrade = useCan('exams.grade');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [summary, setSummary] = useState<ExamOverviewSummary | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [publishing, setPublishing] = useState<ExamOverviewRow | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const list = usePagedList<ExamOverviewRow>(async (page) => {
    const res = await assessmentOverviewApi.exams(filters, page);
    setSummary(res.summary);
    setCourses(res.courses);
    return res;
  }, JSON.stringify(filters));

  const toggleNeeds = (needs: string) => setFilters((f) => ({ ...f, needs: f.needs === needs ? '' : needs }));
  const toggleStatus = (status: string) => setFilters((f) => ({ ...f, status: f.status === status ? '' : status }));

  const publishGrades = async () => {
    if (!publishing) return;
    try {
      setIsPublishing(true);
      await assessmentApi.bulkPublishGrades({ exam_ids: [publishing.id] });
      setMessage({ type: 'success', text: `تم نشر درجات «${publishing.title}» للطلاب.` });
      list.retry();
    } catch (err) {
      setMessage({ type: 'error', text: describeCreateError(err, 'تعذّر نشر الدرجات.') });
    } finally {
      setIsPublishing(false);
      setPublishing(null);
    }
  };

  return (
    <div className="space-y-5 text-start">
      <PageHeader
        title="الاختبارات"
        subtitle="تابع من هنا كل اختبار: من دخل، ومن سلّم، ومن ينتظر التصحيح، والنتائج."
        actions={
          canCreate ? (
            <Button onClick={() => setIsCreating((v) => !v)}>
              {isCreating ? 'إلغاء' : (
                <span className="inline-flex items-center gap-2">
                  <PlusIcon size={14} />
                  إنشاء اختبار جديد
                </span>
              )}
            </Button>
          ) : undefined
        }
      />

      <AssessmentTabs />

      {message && (
        <p role="status" className={`rounded-md border p-3 text-xs font-semibold ${message.type === 'success' ? 'border-success/30 bg-success-subtle text-success' : 'border-danger/30 bg-danger-subtle text-danger'}`}>
          {message.text}
        </p>
      )}

      {isCreating && !list.loading && courses.length === 0 && (
        <DataState state="empty" message="لا يوجد لديك مقرر بعد، والاختبار لازم يتبع مقررًا. أنشئ مقررًا أولًا من صفحة المقررات." />
      )}
      {isCreating && courses.length > 0 && <CreateExamForm courses={courses} defaultCourseId={filters.course_id || courses[0].id} onCancel={() => setIsCreating(false)} />}

      <section aria-label="ملخص الاختبارات" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiFilterButton label="كل الاختبارات" value={summary?.total ?? null} />
        <KpiFilterButton label="منشورة" value={summary?.published ?? null} tone="success" active={filters.status === 'published'} onClick={() => toggleStatus('published')} />
        <KpiFilterButton label="مسودات" value={summary?.draft ?? null} active={filters.status === 'draft'} onClick={() => toggleStatus('draft')} />
        <KpiFilterButton label="طلاب يحلون الآن" value={summary?.in_progress ?? null} tone="info" active={filters.needs === 'in_progress'} onClick={() => toggleNeeds('in_progress')} />
        <KpiFilterButton label="بانتظار التصحيح" value={summary?.pending_grading ?? null} tone={summary?.pending_grading ? 'warning' : 'neutral'} active={filters.needs === 'pending_grading'} onClick={() => toggleNeeds('pending_grading')} />
        <KpiFilterButton label="متوسط الدرجات" value={summary?.average_percent != null ? `${formatNumber(summary.average_percent, 1)}٪` : '—'} />
      </section>

      <OverviewFilters
        value={filters}
        onChange={setFilters}
        courses={courses}
        statusOptions={STATUS_OPTIONS}
        needsOptions={NEEDS_OPTIONS}
        sortOptions={SORT_OPTIONS}
        dateHint="موعد الفتح أو تاريخ الإنشاء"
        searchPlaceholder="ابحث باسم الاختبار أو المقرر..."
      />

      {list.error === 'forbidden' ? (
        <DataState state="forbidden" />
      ) : list.error ? (
        <DataState state="error" onRetry={list.retry} />
      ) : list.loading ? (
        <DataState state="loading" />
      ) : list.items.length === 0 ? (
        <DataState state="empty" message={Object.values(filters).some(Boolean) ? 'لا توجد اختبارات تطابق هذه الفلاتر.' : 'لم يتم إنشاء أي اختبار بعد.'} />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-fg-muted">{formatNumber(list.total)} اختبار</p>
          {list.items.map((exam) => (
            <ExamOverviewCard key={exam.id} exam={exam} canEdit={canCreate} canGrade={canGrade} onPublishGrades={setPublishing} />
          ))}
          {list.hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={list.loadMore} disabled={list.loadingMore}>
                {list.loadingMore ? 'جارٍ التحميل...' : 'عرض المزيد'}
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={publishing !== null}
        onClose={() => setPublishing(null)}
        onConfirm={publishGrades}
        title="نشر الدرجات للطلاب"
        description={`ستظهر درجات «${publishing?.title ?? ''}» للطلاب ويصلهم إشعار بذلك.`}
        confirmText="نشر الدرجات"
        isDestructive={false}
        isLoading={isPublishing}
      />
    </div>
  );
}
